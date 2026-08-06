'use strict';

var adminConsoleControllers = angular.module('AdminConsoleControllers');

adminConsoleControllers.controller('AppController', ['$scope', '$sce', '$http',
  function ($scope, $sce, $http) {
	$scope.appStatus = {
		operationResult: null,
		busy: false
	}

	$scope.restartApp = function () {
		$scope.appStatus.busy = true;
		$http({ method: 'POST', url: '/Admin/RestartApplication' })
			.success(function (data, status, headers, config) {
				$scope.appStatus.operationResult = { level: 'info', message: $sce.trustAsHtml("Applicatie wordt opnieuw opgestart....") };
				setTimeout(function () {
					window.location.href = '/';
				}, 2000);
			})
			.error(function (data, status, headers, config) {
				// ToDo: Angular $http currently doesn't support status text :-/
				$scope.appStatus.operationResult = { level: 'error', message: $sce.trustAsHtml("Er is een fout opgetreden: " + status) };
				$scope.appStatus.busy = false;
		});
	 }
	
  }]);
