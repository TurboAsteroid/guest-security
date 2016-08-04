'use strict';
angular.module('list57Controller', ['ngRoute'])

    .controller('list57Controller', function ($scope, $http, $interval, $mdDialog, $mdMedia, $rootScope, $location, $window, CardN, Doknr, User, GiveProp) {
        $rootScope.apphead = true;
        $rootScope.apptabs = true;
        $scope.show = false;
        $scope.listSpinner = false;
        $scope.data = null;
        $scope.error = false;
        $scope.view1 = true;
        $scope.view2 = false;

        //перегрузка для give
        if ((User.get()).give) {
            $rootScope.apptabs = false;
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
        $scope.$watch(function(){
            return $window.innerWidth;
        }, function(value) {
            if(value < 1275) {
                $scope.view1 = false;
                $scope.view2 = true;
            }
            else {
                $scope.view1 = true;
                $scope.view2 = false;
            }
        });

        //ждем пока страничка загрузится полностью
        $scope.$on('$viewContentLoaded', function () {
            $scope.getInfo();
        });

        $scope.getInfo = function () {
            if($rootScope.apphead == false)
                return;
            $scope.listSpinner = true;
            var headers = {
                'Content-Type': 'application/json;charset=UTF-8',
                'tokenuser':User.get().tokenUser,
                'tokenpassword':User.get().tokenPassword,
                'ckeckpoint':User.get().ckeckpoint,
                'give': User.get().give,
                'list': '57'
            };

            $http({
                method  : 'GET',
                url     : '/api/list?random=' + (new Date()).getTime(),
                headers : headers
            })
                .success(function (data, status) {
                    $scope.listSpinner = false;
                    $scope.error = false;
                    $scope.data = null;
                    var json = JSON.parse(data.data);
                    if(data.success == true) {
                        for (var i = json.length - 1; i > -1; i--)
                            json[i] = $scope.dtConverter(json[i]);
                        $scope.data = json;
                        $scope.show = true;
                    }
                    else {
                        $scope.show = false;
                        $scope.listSpinner = false;
                        $scope.data = null;
                        $scope.error = true;
                    }
                })
                .error(function (data, status) {
                    $scope.show = false;
                    $scope.listSpinner = false;
                    $scope.data = null;
                    $scope.error = true;
                    //alert('Ошибка (getInfo-list57), обратитесь к разработчику по телефону 4-66-63');
                });
        };
        
        //обновляем данные каждые 300 секунд
        $interval($scope.getInfo, 300000);

        $scope.dtConverter = function(obj) {
            obj.DOKNR_int = parseInt(obj.DOKNR);
            obj.E_DATE = obj.E_DATE.slice(6, 8) + '.' +
                obj.E_DATE.slice(4, 6) + '.' +
                obj.E_DATE.slice(0, 4);

            obj.E_TIME = obj.E_TIME.slice(0, 2) + ':' +
                obj.E_TIME.slice(2, 4)+ ':' +
                obj.E_TIME.slice(4, 6);

            obj.VALID_DATE_FROM = obj.VALID_DATE_FROM.slice(6, 8) + '.' +
                obj.VALID_DATE_FROM.slice(4, 6) + '.' +
                obj.VALID_DATE_FROM.slice(0, 4);

            obj.VALID_DATE_TO = obj.VALID_DATE_TO.slice(6, 8) + '.' +
                obj.VALID_DATE_TO.slice(4, 6) + '.' +
                obj.VALID_DATE_TO.slice(0, 4);
            return obj;
        };

        $scope.status = '  ';
        $scope.customFullscreen = $mdMedia('xs') || $mdMedia('sm');
        $scope.showAdvanced = function(ev, doknr) {
            if ((User.get()).give) {
                $scope.cardSpinner = true;
                Doknr.update(doknr);
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
                            GiveProp.set(json);
                            $location.path('/card');
                        }
                        else {
                            //err
                        }

                        $scope.cardSpinner = false;
                        GiveProp.set(data);
                        $location.path('/card');
                    })
                    .error(function (data, status) {
                        $scope.show = false;
                        $scope.cardSpinner = false;
                    });
            }
            else {
                var useFullScreen = ($mdMedia('sm') || $mdMedia('xs')) && $scope.customFullscreen;
                Doknr.update(doknr);
                $mdDialog.show({
                    controller: DialogController57,
                    templateUrl: 'list57/advanced57.html',
                    parent: angular.element(document.body),
                    targetEvent: ev,
                    clickOutsideToClose: true,
                    fullscreen: useFullScreen
                })
                    .then(function (answer) {
                        $scope.status = 'You said the information was "' + answer + '".';
                    }, function () {
                        $scope.status = 'You cancelled the dialog.';
                    });
                $scope.$watch(function () {
                    return $mdMedia('xs') || $mdMedia('sm');
                }, function (wantsFullScreen) {
                    $scope.customFullscreen = (wantsFullScreen === true);
                });
            }
        };

    });

function DialogController57($scope, $mdDialog, $http, $window, Doknr, User) {
    $scope.$watch(function(){
        return $window.innerWidth;
    }, function(value) {
        if(value < 1130) {
            $scope.view1 = false;
            $scope.view2 = true;
        }
        else {
            $scope.view1 = true;
            $scope.view2 = false;
        }
    });

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
                data.APPRDATA[i].APRST_RU = 'ВХОД';
            }
            else if (data.APPRDATA[i].APRST == 'OUT') {
                data.APPRDATA[i].APRST_RU = 'ВЫХОД';
            }
            else {
                data.APPRDATA[i].APRST_RU = 'НЕТ';
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
                $scope.cardN = "";
                $scope.data = dataConstructor(json);
            }
            else {
                //err
            }
        })
        .error(function (data, status) {
            $scope.cardSpinner = false;
            $scope.data = null;
            $scope.cardExists = false;
        });

    $scope.addClass = function(APRST, APRROLE) {
        if(APRROLE == 'IW') {
            if(APRST == 'IN') {
                return 'rsRedBG';
            }
            else if(APRST == 'OUT') {
                return 'rsGreenBG';
            }
            else {
                return 'rsRedBG';
            }
        }
        return 'rsRedBG';
    };
    
    $scope.hide = function() {
        $mdDialog.hide();
    };
    $scope.cancel = function() {
        $mdDialog.cancel();
    };
    $scope.answer = function(answer) {
        $mdDialog.hide(answer);
    };
}