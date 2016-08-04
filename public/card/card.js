'use strict';
angular.module('cardController', ['ngRoute', 'md.data.table','ngFileUpload','ngFileSaver'])

    .controller('cardController', function($scope, $http, $routeParams, $rootScope, $window, $location, $mdDialog, $timeout,
                                           CardN, Doknr, AppHead, User, GiveProp, Upload, FileSaver, Blob) {
        $rootScope.apphead = true;
        $rootScope.apptabs = true;
        $scope.view1 = true;
        //$scope.view2 = '';
        $scope.view3 = false;
        $scope.stateColorBackup = '';
        $scope.show = false;
        //$scope.cardN = '';
        $scope.data = null;
        $scope.cardSpinner = false;
        $scope.cardExists = false;
        $scope.alwaysTrue = true;
        $scope.actionIN = false;
        $scope.actionRET = false;
        $scope.addButton = true;

        //перегрузка для give
        if ((User.get()).give) {
            $rootScope.apptabs = false;
            $scope.cardN = '';
            CardN.set($scope.cardN);
            $scope.view1 = false;
            $scope.cardExists = true;
        }

        $scope.$watch(function(){
            return User.get();
        }, function(user) {
            if (!user.tokenUser || !user.tokenPassword) {
                User.reset();
                CardN.reset();
                Doknr.reset();
                $rootScope.apphead = false;
                $location.path('/');
            }
        });

        /*
        $scope.$watch(function(){
            return $window.innerWidth;
        }, function(value) {
            if(value < 1275) {
                if (!(User.get()).give) {
                    $scope.view1 = false;
                    $scope.view2 = $scope.stateColorBackup;
                }
            }
            else {
                if (!(User.get()).give) {
                    $scope.view1 = true;
                    $scope.view2 = '';
                }
            }
        });
        */

        /*
        $scope.$watch(function(){
            return $scope.file;
        }, function(value) {
            if(value != null) {
                $scope.upload(value);
            }
        });
        */

        //ждем пока страничка загрузится полностью
        $scope.$on('$viewContentLoaded', function(){
            // задержка перед отображением странички
            // т.к. может быть глюк с вкладками
            //$timeout(function() {console.log('delay 200');}, 200);
            $scope.cardN = CardN.get();
            $scope.getInfo();
        });

        $scope.cardN = $routeParams.id;

        var dataConstructor = function (data) {
            data.DATA_CARD.DOKNR_int = parseInt(data.DATA_CARD.DOKNR);
            data.DATA_CARD.VALID_DATE_FROM =
                data.DATA_CARD.VALID_DATE_FROM.slice(6, 8) + '.' +
                data.DATA_CARD.VALID_DATE_FROM.slice(4, 6) + '.' +
                data.DATA_CARD.VALID_DATE_FROM.slice(0, 4);
            data.DATA_CARD.VALID_DATE_TO =
                data.DATA_CARD.VALID_DATE_TO.slice(6, 8) + '.' +
                data.DATA_CARD.VALID_DATE_TO.slice(4, 6) + '.' +
                data.DATA_CARD.VALID_DATE_TO.slice(0, 4);
            var i;
            for (i = data.APPRDATA.length - 1; i > -1; i--) {
                data.APPRDATA[i].CREATED_ON =
                    data.APPRDATA[i].CREATED_ON.slice(6, 8) + '.' +
                    data.APPRDATA[i].CREATED_ON.slice(4, 6) + '.' +
                    data.APPRDATA[i].CREATED_ON.slice(0, 4);
                data.APPRDATA[i].CREATED_TM =
                    data.APPRDATA[i].CREATED_TM.slice(0, 2) + ':' +
                    data.APPRDATA[i].CREATED_TM.slice(2, 4);
                    if (data.APPRDATA[i].APRST == 'IN') {
                        data.APPRDATA[i].APRST_RU = 'Отметка: ВХОД';
                    }
                    else if (data.APPRDATA[i].APRST == 'OUT') {
                        data.APPRDATA[i].APRST_RU = 'Отметка: ВЫХОД';
                    }
                    else {
                        data.APPRDATA[i].APRST_RU = 'Отметка: НЕТ';
                    }
            }
            if(data.DOCUMENTFILES.length > 0) {
                for (i = data.DOCUMENTFILES.length - 1; i > -1; i--) {
                    data.DOCUMENTFILES[i].CREATED_TM =
                        data.DOCUMENTFILES[i].CREATED_TM.slice(0, 2) + ':' +
                        data.DOCUMENTFILES[i].CREATED_TM.slice(2, 4) + ':' +
                        data.DOCUMENTFILES[i].CREATED_TM.slice(4, 6);
                    data.DOCUMENTFILES[i].CREATED_ON =
                        data.DOCUMENTFILES[i].CREATED_ON.slice(6, 8) + '.' +
                        data.DOCUMENTFILES[i].CREATED_ON.slice(4, 6) + '.' +
                        data.DOCUMENTFILES[i].CREATED_ON.slice(0, 4);
                }
            }
            return data;
        };
        $scope.gc = '';
        $scope.addClassGive = function(APPRDATA) {
            for (var i = APPRDATA.length-1; i>0; i--) {
                if(APPRDATA[i].APRROLE == 'IW' && APPRDATA[i].APRST == 'IN')
                    return 'rsRedBG';
            }
            return 'rsGreenBG';
        };

        $scope.clear = function(){
            $scope.cardN = '';
        };

        $scope.backToList57 = function() {
            $location.path('/list57');
        };

        $scope.getInfo = function() {
            if ($scope.cardN.length == '10' && !(User.get()).give) {
                $scope.data = null;
                CardN.set($scope.cardN);
                if ($scope.check()) return;
                $scope.cardExists = false;
                var headers = {
                    'Content-Type': 'application/json;charset=UTF-8',
                    'tokenuser':User.get().tokenUser,
                    'tokenpassword':User.get().tokenPassword,
                    'ckeckpoint':User.get().ckeckpoint,
                    'give': User.get().give,
                    'propusk': CardN.get()
                };
                $scope.cardSpinner = true;
                $http({
                    method  : 'GET',
                    url     : '/api/card?random=' + (new Date()).getTime(),
                    headers : headers
                })
                    .success(function (data, status) {
                        $scope.cardSpinner = false;
                        $scope.cardN = "";
                        var json = JSON.parse(data.data);
                        if (json.RESULT == "SUCCESS") {
                            $scope.data = dataConstructor(json);
                            for (var i = $scope.data.APPRDATA.length - 1; i > -1; i--) {
                                if($scope.data.APPRDATA[i].APRROLE == 'IW'){
                                    $scope.addClass($scope.data.APPRDATA[i].APRST, $scope.data.APPRDATA[i].APRROLE);
                                    break;
                                }
                            }
                            $scope.cardExists = true;
                        }
                        else if (json.RESULT == "CARD_NOT_FOUND") {
                            $scope.data = json;
                            $scope.cardExists = false;
                            $scope.cardN = '';
                            CardN.set($scope.cardN);
                        }
                        else {
                            $scope.data = json;
                            $scope.cardExists = false;
                        }
                        $scope.show = true;
                    })
                    .error(function (data, status) {
                        $scope.show = false;
                        $scope.cardSpinner = false;
                        $scope.data = null;
                        $scope.cardExists = false;
                        //alert('Ошибка (getInfo-card), обратитесь к разработчику по телефону 4-66-63');
                    });
            }
            else if ((User.get()).give) {
                if(GiveProp.get() === null) {
                    $scope.data = GiveProp.get();
                    $scope.show = false;
                    $location.path('/list57');
                }
                else if ($scope.cardN == '') {
                    var json = JSON.parse(GiveProp.get().data);
                    $scope.data = dataConstructor(json);

                    for (var i = $scope.data.ACTIONS.length-1; i >=0; i--) {
                        if($scope.data.ACTIONS[i].ACTION == 'IN')
                            $scope.actionIN = { is: true, DESCRIPTION: $scope.data.ACTIONS[i].DESCRIPTION };
                        if($scope.data.ACTIONS[i].ACTION == 'RET')
                            $scope.actionRET = { is: true, DESCRIPTION: $scope.data.ACTIONS[i].DESCRIPTION }
                    }
                    //if ($scope.data != null || $scope.data != undefined )
                        $scope.gc = $scope.addClassGive($scope.data.APPRDATA);
                    //$scope.view2 = false;
                    $scope.show = true;
                }
                else if ($scope.cardN >=10) {
                    CardN.set($scope.cardN);
                }

            }
            else {
                $scope.cardSpinner = false;
                $scope.data = null;
                $scope.cardExists = false;
                $scope.show = true;
            }
        };

        $scope.check = function() {
            try {
                return parseInt($scope.cardN) < 0;
            }
            catch (err) {
                return true;
            }
        };

        $scope.addClass = function(APRST, APRROLE) {
            if(APRROLE == 'IW') {
                if(APRST == 'IN') {
                    $scope.stateColorBackup = 'rsRedBG';
                    return 'rsRedBG';
                }
                else if(APRST == 'OUT') {
                    $scope.stateColorBackup = 'rsGreenBG';
                    return 'rsGreenBG';
                }
                else {
                    $scope.stateColorBackup = 'rsRedBG';
                    return 'rsRedBG';
                }
            }
            $scope.stateColorBackup = 'rsRedBG';
            return 'rsRedBG';
        };

        $scope.clear = function(){
            $scope.cardN = '';
        };
        
        $scope.backToList57 = function() {
            $location.path('/list57');
        };

//отправка файлов (лучше не трогать пока. функция глючила и отправляла несколько файлов)
        $scope.file = null;
        $scope.upload = function () {
            $scope.states = {
                actionin: $scope.actionIN.is,
                actionret: $scope.actionRET.is,
                addbutton: $scope.addButton
            };
            $scope.actionIN.is = false;
            $scope.actionRET.is = false;
            $scope.addButton = false;
            $scope.cardSpinner = true;
            var headers = {
                'Content-Type': 'application/json;charset=UTF-8',
                'tokenuser':User.get().tokenUser,
                'tokenpassword':User.get().tokenPassword,
                'ckeckpoint':User.get().ckeckpoint,
                'give': User.get().give,
                'doknr': Doknr.get(),
                'objkey': $scope.data.DATA_CARD.DOKAR+$scope.data.DATA_CARD.DOKNR+$scope.data.DATA_CARD.DOKVR+$scope.data.DATA_CARD.DOKTL,
                'objtype': 'ZCARD7105'
            };

            Upload.upload({
                url: 'api/upload',
                method: 'POST',
                headers: headers,
                file: $scope.file
            }).then(function (resp) {
                console.log('Success ' + resp.config.file.name + ' uploaded');
                var headers = {
                    'Content-Type': 'application/json;charset=UTF-8',
                    'tokenuser':User.get().tokenUser,
                    'tokenpassword':User.get().tokenPassword,
                    'ckeckpoint':User.get().ckeckpoint,
                    'give': User.get().give,
                    'doknr': Doknr.get()
                };
                $http({
                    method  : 'GET',
                    url     : '/api/carddoknr?random=' + (new Date()).getTime(),
                    headers : headers
                })
                    .success(function (data, status) {
                        var json = JSON.parse(data.data);
                        if(data.success == true) {
                            $scope.cardSpinner = false;
                            $scope.data = dataConstructor(json);
                            $scope.cardExists = true;
                        }
                        else {
                            $scope.data = json;
                            $scope.cardExists = false;
                        }
                        $scope.cardSpinner = false;
                        $scope.file = null;
                        $scope.actionIN.is = $scope.states.actionin;
                        $scope.actionRET.is = $scope.states.actionret;
                        $scope.addButton = $scope.states.addbutton;
                    })
                    .error(function (data, status) {
                        $scope.cardSpinner = false;
                        $scope.data = null;
                        $scope.cardExists = false;
                        $scope.actionIN.is = $scope.states.actionin;
                        $scope.actionRET.is = $scope.states.actionret;
                        $scope.addButton = $scope.states.addbutton;
                    });
            }, function (resp) {
                console.log('Error status: ' + resp.status);
                $scope.cardSpinner = false;
                actionIN.is = states.actionin;
                actionRET.is = states.actionret;
                $scope.addButton = $scope.states.addbutton;
            }, function (evt) {
                var progressPercentage = parseInt(100.0 * evt.loaded / evt.total);
                console.log('progress: ' + progressPercentage + '% ' + evt.config.file.name);
            });
        };

        $scope.showSendConfirm = function(ev) {
            var confirm = $mdDialog.confirm()
                .title('Предупреждение')
                .textContent('Вы действительно хотите сделать отметку данного пропуска?')
                .targetEvent(ev)
                .ok('Да')
                .cancel('Нет');

            $mdDialog.show(confirm).then(function() {
                $scope.send();
            }, function() {
                //просто отмена
            });
        };
        $scope.send = function () {
            if ($scope.check()) {
                $mdDialog.show(
                    $mdDialog.alert()
                        .clickOutsideToClose(true)
                        .title('Ошибка 2')
                        .textContent('Отметка не выполнена')
                        .ok('OK')
                );
            }
            if ($scope.cardN.length == '10' && (User.get()).give) {
                $scope.actionIN.is = false;
                $scope.actionRET.is = false;
                $scope.addButton = false;
                $scope.cardSpinner = true;
                var headers = {
                    'Content-Type': 'application/json;charset=UTF-8',
                    'tokenuser':User.get().tokenUser,
                    'tokenpassword':User.get().tokenPassword,
                    'ckeckpoint':User.get().ckeckpoint,
                    'give': User.get().give,
                    'propusk': $scope.cardN,
                    'doknr': Doknr.get(),
                    'action': 'IN'
                };

                $http({
                    method  : 'GET',
                    url     : '/api/action?random=' + (new Date()).getTime(),
                    headers : headers
                })
                    .success(function (data, status) {
                        $scope.cardSpinner = false;
                        $scope.actionIN.is = true;
                        $scope.actionRET.is = true;
                        $scope.addButton = true;
                        $scope.backToList57();
                    })
                    .error(function (data, status) {
                        $scope.actionIN.is = true;
                        $scope.actionRET.is = true;
                        $scope.addButton = true;
                        $scope.cardSpinner = false;
                        //не помню надо ли это требует тестирования
                        $scope.show = false;
                        $scope.data = null;
                        $scope.cardExists = false;
                    });
            }
            else {
                //ошибка
                $mdDialog.show(
                    $mdDialog.alert()
                        .clickOutsideToClose(true)
                        .title('Ошибка')
                        .textContent('Отметка не выполнена. Воозможно код пропуска считан неверно. Попробуйте еще раз')
                        .ok('OK')
                );
            }
        };

        $scope.notes = null;
        $scope.showReworkConfirm = function(ev) {
            var confirm = $mdDialog.prompt()
                .title($scope.actionRET.DESCRIPTION)
                .textContent('Вы действительно хотите отправить пропуск ' + $scope.actionRET.DESCRIPTION + '?')
                .placeholder('Причина')
                .targetEvent(ev)
                .ok('Отправить')
                .cancel('Отмена');
            $mdDialog.show(confirm).then(function(result) {
                $scope.notes = result;
                if($scope.notes == undefined || $scope.notes == null || $scope.notes < 3)
                    $mdDialog.show(
                        $mdDialog.alert()
                            .clickOutsideToClose(true)
                            .title('Ошибка')
                            .textContent('Операция не выполнена. Пожалуйста, укажите причину отправки ' + $scope.actionRET.DESCRIPTION)
                            .ariaLabel('')
                            .ok('OK')
                    );
                else
                    $scope.rework();
            }, function() {
                //просто отмена
            });
        };
        $scope.rework = function () {

            if ((User.get()).give) {
                $scope.actionIN.is = false;
                $scope.actionRET.is = false;
                $scope.addButton = false;
                $scope.cardSpinner = true;
                var headers = {
                    'Content-Type': 'application/json;charset=UTF-8',
                    'tokenuser': User.get().tokenUser,
                    'tokenpassword': User.get().tokenPassword,
                    'ckeckpoint': User.get().ckeckpoint,
                    'give': User.get().give,
                    'propusk': 'none',
                    'doknr': Doknr.get(),
                    'action': 'RET'
                };

                $http({
                    method: 'GET',
                    url: '/api/action?random=' + (new Date()).getTime() + '&notes=' + $scope.notes,
                    headers: headers
                })
                    .success(function (data, status) {
                        $scope.cardSpinner = false;
                        $scope.actionIN.is = true;
                        $scope.actionRET.is = true;
                        $scope.addButton = true;
                        if (data.success == true) {
                            var confirm = $mdDialog.confirm()
                                .clickOutsideToClose(true)
                                .title('Выполнено')
                                .textContent('Операция выполнена успешно')
                                .ok('OK')
                            $mdDialog.show(confirm).then(function (result) {
                                $scope.backToList57();
                            }, function () {
                                //просто отмена
                            });
                        }
                        else {
                            //ОШИБКА
                        }
                    })
                    .error(function (data, status) {
                        $scope.actionIN.is = true;
                        $scope.actionRET.is = true;
                        $scope.addButton = true;
                        $scope.cardSpinner = false;
                        $scope.show = false;
                        $scope.data = null;
                        $scope.cardExists = false;
                        var confirm = $mdDialog.confirm()
                            .clickOutsideToClose(true)
                            .title('Ошибка')
                            .textContent('Ошибка при отправке пропуска ' + $scope.actionRET.DESCRIPTION + '. Проверьте сетевое соединение')
                            .ok('OK')
                        $mdDialog.show(confirm).then(function (result) {
                            $scope.backToList57();
                        }, function () {
                            //просто отмена
                        });
                    });
            }
        };

        $scope.open = function (rec_ext_id, version, description) {
            var headers = {
                'Content-Type': 'application/json;charset=UTF-8',
                'tokenuser':User.get().tokenUser,
                'tokenpassword':User.get().tokenPassword,
                'ckeckpoint':User.get().ckeckpoint,
                'give': User.get().give,
                'doknr': Doknr.get(),
                'version': version,
                'rec_ext_id': rec_ext_id
            };
            $http({
                url: '/api/openfile?random=' + (new Date()).getTime(),
                method: "GET",
                headers: headers,
                responseType: "arraybuffer"
            }).then(function successCallback(response) {
                try {
                    var ct = response.headers('Content-Type');
                    var strFile = response.headers('content-disposition');
                    var filename = '';
                    var flag = false;
                    for (var i = 0; i < strFile.length; i++) {
                        if (strFile[i] == '"' || flag) {
                            flag = true;
                            filename += strFile[i + 1];
                            if (strFile[i + 2] == '"')
                                break;
                        }
                    }
                    var data = new Blob([response.data], {type: ct});
                    FileSaver.saveAs(data, description);
                }
                catch (err) {
                    console.log(err);
                    $mdDialog.show(
                        $mdDialog.alert()
                            .clickOutsideToClose(true)
                            .title('Ошибка')
                            .textContent('Невозможно открыть файл')
                            .ok('OK')
                    );
                }
            }, function errorCallback(response) {
                console.log(response);
                $mdDialog.show(
                    $mdDialog.alert()
                        .clickOutsideToClose(true)
                        .title('Ошибка')
                        .textContent('Невозможно открыть файл. ' + response.message)
                        .ok('OK')
                );
            });
        };
    });