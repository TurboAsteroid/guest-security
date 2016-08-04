'use strict';
var appGS = angular.module('appGS', ['ngRoute',
                                     'ngMaterial',
                                     'md.data.table',
                                     'cardController',
                                     'list51Controller',
                                     'list57Controller',
                                     'list53Controller',
                                     'authController',
                                     'ngFileSaver']);

appGS.config(function($routeProvider) {
    $routeProvider
        .when('/', {
                templateUrl : 'auth/auth.html',
                controller  : 'authController'
            })
        .when('/card', {
            templateUrl : 'card/card.html',
            controller  : 'cardController'
        })
        .when('/list51', {
            templateUrl : 'list51/list51.html',
            controller  : 'list51Controller'
        })
        .when('/list57', {
            templateUrl : 'list57/list57.html',
            controller  : 'list57Controller'
        })
        .when('/list53', {
            templateUrl : 'list53/list53.html',
            controller  : 'list53Controller'
        })
        .when('/giveprop', {
            templateUrl : 'giveprop/giveproplist.html',
            controller  : 'giveproplistController'
        })
        .otherwise({ redirectTo: '/' });
});

appGS.config(function($mdThemingProvider) {
    $mdThemingProvider.theme('default')
        .primaryPalette('blue-grey')
        .warnPalette('red');
});

appGS.config(['$compileProvider', function ($compileProvider) {
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(|blob|):/);
}]);

appGS.run(function($rootScope, $route, $location){
    //Bind the `$locationChangeSuccess` event on the rootScope, so that we dont need to
    //bind in induvidual controllers.

    $rootScope.$on('$locationChangeSuccess', function() {
        $rootScope.actualLocation = $location.path();
    });

    $rootScope.$watch(function () {return $location.path()}, function (newLocation, oldLocation) {
        if($rootScope.actualLocation === newLocation) {
            $rootScope.actualLocation = $location.path(oldLocation);
        }
    });
});

appGS.controller('navigationController', function ($scope, $location, $rootScope, User, GiveProp) {
    $rootScope.apphead = false;
    $scope.go = function (path) {
        $location.path(path);
    };
    $scope.logout = function () {
        User.reset();
        GiveProp.reset();
        $rootScope.apphead = false;
        $rootScope.headTitle = undefined;
        $location.path('/');
    };
});

appGS.factory('CardN', function() {
    var cardN_var = '';
    return {
        set: function(new_cardN_var) {
            cardN_var = new_cardN_var;
        },
        get: function() {
            return cardN_var;
        },
        reset: function() {
            cardN_var = '';
        }
    };
});

appGS.factory('Doknr', function() {
    var doknr_var = '';
    return {
        update: function(new_doknr_var) {
            doknr_var = new_doknr_var;
        },
        get: function() {
            return doknr_var;
        },
        reset: function() {
            doknr_var = '';
        }
    };
});

appGS.factory('AppHead', function() {
    var apphead_var = false;
    return {
        set: function(new_apphead_var) {
            apphead_var = new_apphead_var;
        },
        get: function() {
            return apphead_var;
        }
    };
});

appGS.factory('User', function() {
    var user_var = {
        'username' : null,
        'password' : null,
        'kpp' : null,
        'tokenUser' : null,
        'tokenPassword' : null,
        'give' : null
    };
    return {
        set: function(new_user_var) {
            user_var = new_user_var;
        },
        get: function() {
            return user_var;
        },
        reset: function() {
            user_var = {
                'username' : null,
                'password' : null,
                'kpp' : null,
                'tokenUser' : null,
                'tokenPassword' : null,
                'give' : null
            };
            return true;
        }
    };
});

appGS.factory('GiveProp', function() {
    var data_var = null;
    return {
        set: function(new_data_var) {
            data_var = new_data_var;
        },
        get: function() {
            return data_var;
        },
        reset: function() {
            data_var = null;
            return true;
        }
    };
});