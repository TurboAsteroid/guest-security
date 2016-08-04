'use strict';
angular.module('authController', ['ngRoute', 'ngMessages'])

.controller('authController', function($scope, $http, $location, $rootScope, AppHead, User) {
    $scope.user = User.get();
    $rootScope.apphead = false;
    $rootScope.apptabs = false;
    $scope.login = function () {
        $scope.message = '';
        $scope.entering = true;
        var headers = {
            'Content-Type': 'application/json;charset=UTF-8',
            'username': $scope.user.username,
            'password': $scope.user.password
        };
        $http({
            method  : 'POST',
            url     : '/api/authenticate',
            headers : headers
        })
            .success(function (data, status, headers, config) {
                if(data.success) {
                    $scope.entering = false;
                    $rootScope.userLogin = $scope.user.username;
                    $scope.user.username = '';
                    $scope.user.password = '';
                    var user_var = {
                        'username' : null,
                        'password' : null,
                        'ckeckpoint': data.ckeckpoint,
                        'give': data.give,
                        'tokenUser' : data.tokenUser,
                        'tokenPassword' : data.tokenPassword
                    };
                    User.set(user_var);
                    if(user_var.ckeckpoint == '11008')
                        $rootScope.mainHeadTitle = 'Разовый пропуск: инженерный корпус';
                    if(user_var.ckeckpoint == '11002')
                        $rootScope.mainHeadTitle = 'Разовый пропуск: центральная проходная';
                    if(user_var.ckeckpoint == '11008' && user_var.give)
                        $rootScope.mainHeadTitle = 'Разовый пропуск: инженерный корпус - выдача пропуска';
                    if(user_var.ckeckpoint == '11002' && user_var.give)
                        $rootScope.mainHeadTitle = 'Разовый пропуск: центральная проходная - выдача пропуска';

                    $location.path('/card')
                }
                else {
                    $scope.entering = false;
                    $scope.user.password = '';
                    $scope.message = data.message;
                }
            })
            .error(function (data, status, header, config) {
                $scope.entering = false;
                $scope.user.password = '';
                $scope.message = data.message;
            });
    };
});