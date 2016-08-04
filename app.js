//зависимости
var fs              = require('fs');
var https           = require('https');
var http            = require('http');
var express 	    = require('express');
var bodyParser      = require('body-parser');
var ActiveDirectory = require('activedirectory');
var jwt             = require('jsonwebtoken');
var config          = require('./config');
var request         = require('request');
var async           = require('async');
var multiparty      = require('connect-multiparty');

var app             = express();
app.set('portHttps', config.portHttps);
app.set('portHttp', config.portHttp);
var port = process.env.PORT || parseInt(app.get('portHttps'));
app.all('*', function(req, res, next){
    if (req.secure)
        return next();
    res.redirect('https://'+req.hostname+':'+port+req.url);
});

//настройки
app.set('sapUser', config.sapUser);
app.set('sapPassword', config.sapPassword);
app.set('url', config.url);
app.set('adServer', config.adServer);
app.set('adBaseDN', config.adBaseDN);
app.set('adUser', config.adUser);
app.set('adPassword', config.adPassword);
app.set('superSecret', config.secret);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

request = request.defaults({jar: true});

// Настройка модуля ActiveDirectory
var groupNames = ['GS11008','GS11002','GSGive'];//порядок важен!
var ad = new ActiveDirectory({
    url: app.get('adServer'),
    baseDN: app.get('adBaseDN'),
    username: app.get('adUser'),
    password: app.get('adPassword')
});

app.use(express.static('public')); //папка со статическими файлами

var apiRoutes = express.Router(); //объявление роутера

//точка входа в роутер
apiRoutes.get('/', function(req, res) {
    res.status(403).send('API входа и получения данных');
});

//аутентификация пользователя
function auth(userAndPassword, callback){
    var username = userAndPassword.username;
    var password = userAndPassword.password;
    async.waterfall([
        function(callback) {
            ad.authenticate(username + '@elem.ru', password, function (err, isAuthenticated) {
                if (err) {
                    callback(err,{success: false, message: 'Некорректное имя пользователя или пароль'});
                }
                if (isAuthenticated) {
                    callback(err,{success: true, message: 'Аутентификация прошла успешно'});
                }
            })
        }
    ], function (err, result) {
        callback(err, result, username, password );
    });
}

//проверка принадлежности к группе
function checkGroup(authenticated, username, password, callback){
    if(authenticated.success) {
        //проверяем на членство в группах
        async.parallel({
                GS11008: function (callback) {
                    ad.isUserMemberOf(username, groupNames[0], function (err, isMember) {
                        callback(err, isMember);
                    });
                },
                GS11002: function (callback) {
                    ad.isUserMemberOf(username, groupNames[1], function (err, isMember) {
                        callback(err, isMember);
                    });
                },
                GSGive: function (callback) {
                    ad.isUserMemberOf(username, groupNames[2], function (err, isMember) {
                        callback(err, isMember);
                    });
                }
            },
            function (err, userGroup) {
                if (!userGroup.GS11008 && !userGroup.GS11002 && !userGroup.GSGive)
                    //при авторизации обнаружилось, что пользователь не принадлежит группе
                    callback(true, {success:false, GS11008: userGroup.GS11008, GS11002: userGroup.GS11002, GSGive: userGroup.GSGive,  message: 'Доступ запрещен'});
                else if (userGroup.GS11008 && userGroup.GS11002 && userGroup.GSGive)
                    //при авторизации обнаружилось, что пользователь не принадлежит группе
                    callback(true, {success:false, GS11008: userGroup.GS11008, GS11002: userGroup.GS11002, GSGive: userGroup.GSGive,  message: 'Пользователь имеет двусмысленные права'});
                else
                    //все хорошо, продолжаем
                    callback(err, userGroup, username, password);
            });
    }
    else {
        callback(true, { "GS11008": false, "GS11002": false, "GSGive": false, message: 'Неизвестная ошибка 1' } );
    }
}

//генерация токенов (кодирование имени пользователя и пароля)
function createTokens(userGroup, username, password, callback){
    var tokenUser = jwt.sign(username, app.get('superSecret')); //шифруем имя пользователя
    var tokenPassword = jwt.sign(password, app.get('superSecret')); //шифруем пароль
    //вычисляем интерфейс
    var give = false;
    var ckeckpoint = null;
    //выдача пропуска
    if(userGroup.GSGive) {
        give = true;
    }
    //кпп инженерный корпус
    if(userGroup.GS11008) {
        ckeckpoint = 11008;
    }
    //кпп 7
    if(userGroup.GS11002) {
        ckeckpoint = 11002;
    }
    callback(null,{success: true, tokenUser: tokenUser, tokenPassword: tokenPassword, ckeckpoint: ckeckpoint, give: give});
}

//декодирование токенов
function decodeTokens(data, callback){
    var tokenUser = data.tokenuser; //получаем токен имени пользователя
    var tokenPassword = data.tokenpassword; //получаем токен папроля
    async.parallel({ //дешифруем токен пользователя и пароля параллельно
            user: function (callback) {
                jwt.verify(tokenUser, app.get('superSecret'), function (err, decoded) {
                    callback(err, decoded);
                });
            },
            password: function (callback) {
                jwt.verify(tokenPassword, app.get('superSecret'), function (err, decoded) {
                    callback(err, decoded);
                });
            }
        },
        function (err, userAndPassword) {
            //выполняем действия и проверки после дешифрации и отправляем результат
            if(err)
                callback(err, {success: false, message: 'Доступ запрещен. Ошибка декодирования имени пользователя и пароля'});
            else
                callback(err, {
                    success: true,
                    message: 'Декодирование токенов завершено успешно',
                    username: userAndPassword.user,
                    password: userAndPassword.password
                });
        });
}

//проводим авторизацию
apiRoutes.post('/authenticate', function(req, res) {
    async.waterfall([ //последовательно проверяем (водопадом)
        async.apply(auth, { username: req.headers['username'], password: req.headers['password']}),//входит ли в группу
        checkGroup, //входит ли в группу
        createTokens //создаем токен
    ], function (err, result) { //отправляем результат
        if(err)
            res.status(400).send(result);
        else
            res.status(200).send(result);
    });
});

//получаем листы
apiRoutes.get('/list', function(req, res) {
    //создадим алиасы (для удобства и передачи после водопада)
    var tu = req.headers['tokenuser'],
        tp = req.headers['tokenpassword'],
        c = req.headers['ckeckpoint'],
        g = req.headers['give'],
        l = req.headers['list'];
    try { //переданы ли какие-нибудь вообще данные
        tu.length;
        tp.length;
        c.length;
        l.length;
        if(g == null || g == undefined)
            throw g;
    }
    catch (err) { //если длина одного из алиасов кривая
        return res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра', err: err});
    }
    async.waterfall([ //водопадом
        async.apply(decodeTokens, { tokenuser: tu, tokenpassword: tp}), //декодируем токены
        auth,//входит ли в группу
        checkGroup, //входит ли в группу
        createTokens //создаем токен
    ], function (err, result) {
        var url_sap = '';
        if(err)
            res.status(400).send(result); //отправляем ошибку
        try { //повторная проверка (избыточно, но все же) переданы ли какие-нибудь вообще данные
            tu.length;
            tp.length;
            c.length;
            l.length;
            if(g == null || g == undefined)
                throw g;
        }
        catch (err2) {
            return res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра', err: err2});
        } //ниже проверки на все
        if (!err && c.toString() === (result.ckeckpoint).toString() && g.toString() === (result.give).toString() &&
            (l).toString() === '57') { //если статус 57 (согласованы) - выдавать всем двум группам
                url_sap = app.get('url') + //формирование ссылки до сапа
                            '/list?status=' + l +
                            '&ckeckpoint=' + c +
                            '&sap-user=' + app.get('sapUser') +
                            '&sap-password=' + app.get('sapPassword');
                request.get({ //формирование запроса и получение данных с сервера сапа
                    url: url_sap,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36'
                    }
                }, function (error, response, body) {
                    try {//обработка полученных данных
                        if (response.body == 'Login Error' || response.body == undefined) //если пришла ошибка
                            res.status(403).send({success: false, message: 'Доступ запрещен (SAP)'}); //отправляем ошибку
                        else if (!error && response.statusCode == 200) //если проишла не ошибка
                            res.status(200).send({ //отправляем список пропусков
                                success: true,
                                message: 'Список пропусков предоставлен. Статус пропусков ' + l,
                                data: body
                            });
                    } catch (error) { //отправляем ошибку сервера
                        res.status(500).send({success: false, message: 'Доступ запрещен. Ошибка сервера'});
                    }
                });
        }
        else if (!err && c.toString() === (result.ckeckpoint).toString() && //только для охраны
            (g.toString() === (false).toString() && g.toString() === (result.give).toString()) &&
            ((l).toString() === '51' || (l).toString() === '53' )) { //если статус 53 и 51 (на территории и на согласовании) - выдавать всем двум группам
                url_sap = app.get('url') + //формирование ссылки до сапа
                    '/list?status=' + l +
                    '&ckeckpoint=' + c +
                    '&sap-user=' + app.get('sapUser') +
                    '&sap-password=' + app.get('sapPassword');
                request.get({ //формирование запроса и получение данных с сервера сапа
                    url: url_sap,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36' }
                }, function (error, response, body) {
                    try { //обработка полученных данных
                        if (response.body == 'Login Error' || response.body == undefined) //если пришла ошибка
                            res.status(403).send({success: false, message: 'Доступ запрещен (SAP)'}); //отправляем ошибку
                        else if (!error && response.statusCode == 200)
                            res.status(200).send({ //если проишла не ошибка
                                success: true,
                                message: 'Список пропусков предоставлен. Статус пропусков ' + l,
                                data: body
                            });
                    } catch (error) { //отправляем ошибку сервера
                        res.status(500).send({success: false, message: 'Доступ запрещен. Ошибка сервера'});
                    }
                });
        }
    });
});

//получаем карточку по номеру пропуска
apiRoutes.get('/card', function(req, res) {
    //создадим алиасы (для удобства и передачи после водопада)
    var tu = req.headers['tokenuser'],
        tp = req.headers['tokenpassword'],
        c = req.headers['ckeckpoint'],
        g = req.headers['give'],
        p = req.headers['propusk'];
    try { //переданы ли какие-нибудь вообще данные
        tu.length;
        tp.length;
        c.length;
        p.length;
        if(g == null || g == undefined)
            throw g;
    }
    catch (err) { //если длина одного из алиасов кривая
        return res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра', err: err});
    }
    async.waterfall([ //водопадом
        async.apply(decodeTokens, { tokenuser: tu, tokenpassword: tp}),  //декодируем токены
        auth,//входит ли в группу
        checkGroup, //входит ли в группу
        createTokens //создаем токен
    ], function (err, result) {
        try { //переданы ли какие-нибудь вообще данные
            tu.length;
            tp.length;
            c.length;
            p.length;
            if(g == null || g == undefined)
                throw g;
        }
        catch (err) { //если длина одного из алиасов кривая
            return res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра', err: err});
        }
        if(err) //если ошибка
            res.status(400).send(result); //отправить ошибку
        else if(!err && (c == result.ckeckpoint) && (g == (result.give).toString()) && (p.length == 10))
        {
            var url_sap = app.get('url') + //формирование ссылки до сапа
                        '/main?propusk=' + p +
                        '&ckeckpoint=' + c +
                        '&sap-user=' + app.get('sapUser') +
                        '&sap-password=' + app.get('sapPassword');
            request.get(url_sap, function (error, response, body) {  //формирование запроса и получение данных с сервера сапа
                try {
                    if (response.body == 'Login Error' || response.body == undefined) //если пришла ошибка
                        res.status(403).send({success: false, message: 'Доступ запрещен (SAP)'}); //отправляем ошибку
                    else if (!error && response.statusCode == 200)
                        res.status(200).send({success: true, message: 'Предоставлены все данные по пропуску номер ' + p, data: body}); //отправляем пропуск
                } catch (error) {
                    res.status(500).send({success: false, message: 'Доступ запрещен. Ошибка сервера'}); //отправляем ошибку
                }
            });
        }
        else if((c != result.ckeckpoint) || (g != (result.give).toString())) //проверка на совпадение кпп/тетки переданного и разрешенного
            res.status(403).send({success: false, message: 'Доступ запрещен'}); //отправляем ошибку
        else
            res.status(400).send({success: false, message: 'Доступ запрещен'}); //отправляем ошибку
    });
});

//получаем карточку по номеру документа сап
apiRoutes.get('/carddoknr', function(req, res) {
    //создадим алиасы (для удобства и передачи после водопада)
    var tu = req.headers['tokenuser'],
        tp = req.headers['tokenpassword'],
        c = req.headers['ckeckpoint'],
        g = req.headers['give'],
        d = req.headers['doknr'];
    try { //переданы ли какие-нибудь вообще данные
        tu.length;
        tp.length;
        c.length;
        d.length;
        if(g == null || g == undefined)
            throw g;
    }
    catch (err) { //если длина одного из алиасов кривая
        return res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра', err: err.message});
    }
    async.waterfall([
        async.apply(decodeTokens, { tokenuser: tu, tokenpassword: tp}),  //декодируем токены
        auth,//входит ли в группу
        checkGroup, //входит ли в группу
        createTokens //создаем токен
    ], function (err, result) {
        try { //переданы ли какие-нибудь вообще данные
            tu.length;
            tp.length;
            c.length;
            d.length;
            if(g == null || g == undefined)
                throw g;
        }
        catch (err) { //если длина одного из алиасов кривая
            return res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра', err: err});
        }
        if(err)  //если ошибка
            res.status(400).send(result); //отправляем ошибку
        else if( !err && (c == result.ckeckpoint) && (g == (result.give).toString()) && (d.length > 0) )
        {
            var url_sap = app.get('url') + '/main?doknr=' + d +  //формирование ссылки до сапа
                            '&ckeckpoint=' + c +
                            '&sap-user=' + app.get('sapUser') +
                            '&sap-password=' + app.get('sapPassword');
            request.get(url_sap, function (error, response, body) {
                try {
                    if (response.body == 'Login Error' || response.body == undefined) //если пришла ошибка
                        res.status(403).send({success: false, message: 'Доступ запрещен (SAP)'}); //отправляем ошибку
                    else if (!error && response.statusCode == 200)
                        res.status(200).send({success: true, message: 'Предоставлены все данные по пропуску номер ' + d, data: body});
                } catch (error) {
                    res.status(500).send({success: false, message: 'Доступ запрещен. Ошибка сервера'}); //отправляем ошибку
                }
            });
        }
        else if((c != result.ckeckpoint) || (g != (result.give).toString())) { //проверка на совпадение кпп/тетки переданного и разрешенного
            res.status(403).send({success: false, message: 'Доступ запрещен'}); //отправляем ошибку
        }
        else {
            res.status(400).send({success: false, message: 'Доступ запрещен'}); //отправляем ошибку
        }

    });
});

//отправка файлов (лучше не трогать пока. функция глючила и отправляла несколько файлов)
var	multipartyMiddleware = multiparty();
apiRoutes.post('/upload', multipartyMiddleware, function(req, res) {
    //создадим алиасы (для удобства и передачи после водопада)
    var tu = req.headers['tokenuser'],
        tp = req.headers['tokenpassword'],
        ot = req.headers['objtype'],
        ok = req.headers['objkey'],
        f = req.files.file;
    try { //переданы ли какие-нибудь вообще данные
        tu.length;
        tp.length;
        ot.length;
        ok.length;
    }
    catch (err) { //если длина одного из алиасов кривая
        return res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра', err: err.message});
    }
    try {
        if (f == undefined)
            return res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра'});
    }
    catch (err) {
        return res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра', err: err.message});
    }
    async.waterfall([
        async.apply(decodeTokens, { tokenuser: tu, tokenpassword: tp}),  //декодируем токены
        auth,//входит ли в группу
        checkGroup, //входит ли в группу
        createTokens //создаем токен
    ], function (err, result) {
        if (err)
            res.status(400).send(result);
        else if(result.success) {
            try { //переданы ли какие-нибудь вообще данные
                tu.length;
                tp.length;
                ot.length;
                ok.length;
            }
            catch (err) { //если длина одного из алиасов кривая
                res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра', err: err.message});
                res.end();
            }
            if(f != null || f != undefined) { //очередная проверка на существование файла
                fs.readFile(f.path, function (err, data) { //читаем файл из потока, который пришел постом
                    if (!err) { //продолжаем, если не ошибка чтения
                        var newPath = __dirname + "\\tmp\\" + f.name; //путь до файла, в который будет произведена запись
                        fs.writeFile(newPath, data, function (err) { //пишем в файл
                            if (!err) {//если не ошибка записи
                                var url = app.get('url') + '/file_upload' + //формируем ссылку к сапу
                                          '?objtype=' + ot +
                                          '&objkey=' + ok +
                                          '&sap-user=' + app.get('sapUser') +
                                          '&sap-password=' + app.get('sapPassword');
                                var req = request.post(url, function (err, resp, body) { //делаем запрос на пост в сап
                                    res.end();
                                });
                                var form = req.form(); //будем отправлять как форма в html
                                form.append('file', fs.createReadStream(newPath)); //говорим, что пишем файл из потока, который читаем с файловой системы сервера
                                fs.unlink(newPath); //удаляем файл
                            }
                            else {
                                res.sendStatus(500).send({
                                    success: false,
                                    message: 'Ошибка записи полученного файла на сервере Node.JS: ' + err.message
                                });
                            }
                        });
                    }
                    else
                        res.sendStatus(500).send({ //отправляем ошибку
                            success: false,
                            message: 'Ошибка чтения полученного файла на сервере Node.JS: ' + err.message
                        });
                });
            }
        }
        else {
            res.status(400).send(result); //отправляем ошибку
        }
    });
});

//делаем отметку
apiRoutes.get('/action', function(req, res) {
    //создадим алиасы (для удобства и передачи после водопада)
    var tu = req.headers['tokenuser'],
        tp = req.headers['tokenpassword'],
        d = req.headers['doknr'],
        p = req.headers['propusk'],
        c = req.headers['ckeckpoint'],
        g = req.headers['give'],
        n = req.query.notes,
        a = req.headers['action'];
    try { //переданы ли какие-нибудь вообще данные
        tu.length;
        tp.length;
        d.length;
        p.length;
        c.length;
        if(g == null || g == undefined)
            throw g;
        a.length;
        if(a == 'RET')
            n.length;
    }
    catch (err) { //если длина одного из алиасов кривая
        return res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра', err: err.message});
    }
    async.waterfall([
        async.apply(decodeTokens, { tokenuser: tu, tokenpassword: tp}),  //декодируем токены
        auth,//входит ли в группу
        checkGroup, //входит ли в группу
        createTokens //создаем токен
    ], function (err, result) {
        if(err) //ошибка сразу
            res.status(400).send(result);
        //отметка?
        else if( !err && (c == result.ckeckpoint) && (g == (result.give).toString()) &&
                 (d.length > 0) && (p.length == 10) && (a == 'IN') )
        {
            var url_sap = app.get('url') + '/main?action=' + a + '&propusk=' + p + '&doknr=' + d + '&ckeckpoint=' + c +
                          '&sap-user=' + app.get('sapUser') + '&sap-password=' + app.get('sapPassword');
            request.get(url_sap, function (error, response, body) {
                try {
                    if (response.body == 'Login Error' || response.body == undefined)
                        res.status(403).send({success: false, message: 'Доступ запрещен (SAP)'});
                    else if (!error && response.statusCode == 200)
                        res.status(200).send({success: true, message: 'Предоставлены все данные по пропуску номер ' + p, data: body});
                    else
                        res.status(403).send({success: false, message: 'Доступ запрещен'});
                } catch (error) {
                    res.status(500).send({success: false, message: 'Доступ запрещен. Ошибка сервера'});
                }
            });
        }
        //на доработку?
        else if( !err && (c == result.ckeckpoint) && (g == (result.give).toString()) &&
                 (d.length > 0) && (n.length > 3) && (a == 'RET') )
        {
            var url_sap = app.get('url') + '/main?action=' + a + '&doknr=' + d + '&ckeckpoint=' + c +
                          '&sap-user=' + app.get('sapUser') + '&sap-password=' + app.get('sapPassword');
            request.post({url: url_sap, form: {notes: n}}, function(error,response,body){
                try {
                    if (error)
                        throw error
                    else if (response.body == 'Login Error' || response.body == undefined)
                        res.status(403).send({success: false, message: 'Доступ запрещен (SAP)'});
                    else if (!error && response.statusCode == 200)
                        res.status(200).send({success: true, message: 'Пропуск отправлен на доработку ' + d, data: body});
                    else
                        res.status(403).send({success: false, message: 'Доступ запрещен'});
                } catch (err) {
                    res.status(500).send({success: false, message: 'Доступ запрещен. Ошибка сервера. ' + err.message});
                }
            });
        }
        //нет такого действия
        else if((c != result.ckeckpoint) || (g != (result.give).toString()))
            res.status(403).send({success: false, message: 'Доступ запрещен. Запрашиваемого действия не существует'});
        else
            res.status(400).send({success: false, message: 'Доступ запрещен'});
    });
});

//открываем файл
apiRoutes.get('/openfile', function(req, res) {
    var incomingMessage = req;
    if( incomingMessage.headers['tokenuser']  == undefined ||
        incomingMessage.headers['tokenpassword'] == undefined ||
        incomingMessage.headers['doknr']  == undefined ||
        incomingMessage.headers['rec_ext_id'] == undefined ||
        incomingMessage.headers['version'] == undefined)
        return res.status(403).send({success: false, message: 'Доступ запрещен. Ошибка передачи параметра'});
    async.waterfall([
        async.apply(decodeTokens, { tokenuser: req.headers['tokenuser'], tokenpassword: req.headers['tokenpassword']}),
        auth,
        checkGroup,
        createTokens
    ], function (err, result) {
        if(err)
            res.status(400).send(result);
        else if(!err &&
            (incomingMessage.headers['ckeckpoint'] == result.ckeckpoint) &&
            (incomingMessage.headers['give'] == (result.give).toString()) &&
            (incomingMessage.headers['doknr'].length > 0) &&
            (incomingMessage.headers['rec_ext_id'] != undefined) &&
            (incomingMessage.headers['version'] != undefined)
        )
        {
            var url_sap = app.get('url') +
                '/file?rec_ext_id=' + incomingMessage.headers['rec_ext_id'] +
                '&version=' + incomingMessage.headers['version'] +
                '&doknr=' + incomingMessage.headers['doknr'] +
                '&ckeckpoint=' + incomingMessage.headers['ckeckpoint'] +
                '&sap-user=' + app.get('sapUser') +
                '&sap-password=' + app.get('sapPassword');
            var filename = __dirname + "\\tmp\\";
            var headers = '';
            request.get({url: url_sap, encoding: 'binary'}, function (err, response, body) {
                try {
                    headers = response.headers;
                    var strFile = response.headers['content-disposition'];
                    var flag = false;
                    for (var i = 0; i < strFile.length; i++) {
                        if (strFile[i] == '"' || flag) {
                            flag = true;
                            filename += strFile[i + 1];
                            if (strFile[i + 2] == '"')
                                break;
                        }
                    }
                    fs.writeFile(filename, body, 'binary', function(err) {
                        if(err)
                            res.status(500).send({success: false, message: 'Доступ запрещен. Ошибка сервера', err: err});
                        else
                            res.download(filename);
                    });
                }
                catch (err) {
                    res.status(500).send({success: false, message: 'Доступ запрещен. Ошибка сервера', err: err});
                }
            });
        }
        else if((incomingMessage.headers['ckeckpoint'] != result.ckeckpoint) || (incomingMessage.headers['give'] != (result.give).toString())) {
            res.status(403).send({success: false, message: 'Доступ запрещен'});
            res.end();
        }
        else {
            res.status(400).send({success: false, message: 'Доступ запрещен'});
            res.end();
        }
    });
});

app.use('/api', apiRoutes);
// =================================================================
// start the server ================================================
// =================================================================
https.createServer({
    key: fs.readFileSync('cert/server.key'),
    cert: fs.readFileSync('cert/server.pem')
}, app).listen(port);
console.log('Https-сервер запущен на порту ' + port);

http.createServer(app).listen(parseInt(app.get('portHttp')), function() {
    console.log('Http-сервер редиректа запущен на порту ' + parseInt(app.get('portHttp')));
});