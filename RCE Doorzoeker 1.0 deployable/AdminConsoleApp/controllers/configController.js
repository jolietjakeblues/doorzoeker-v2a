'use strict';

var adminConsoleControllers = angular.module('AdminConsoleControllers');

adminConsoleApp.controller('ConfigController', ['$scope', '$sce', '$http',
  function ($scope, $sce, $http) {

	$scope.uploadSubmit = function () {
		$scope.appStatus.busy = true;

		// define an event on the window object the IFrame can invoke when it's done receiving the upload's response
		// ToDo: Look at the AngularJs Upload nuget package
		window.configUploadCompleted = function (result) {
			if (result.success) {
				$scope.appStatus.operationResult = { level: 'info', message: $sce.trustAsHtml('Het configuratie bestand is succesvol geplaatst. Applicatie wordt opnieuw opgestart....') };
				setTimeout(function () {
					window.location.href = '/';
				}, 2000);
			} else {
				$scope.appStatus.busy = false;
				var entries = result.messages.map(function (m) {
					return '<li>' + m.message + '</li>';
				});
				var resultMessage = 'Het configuratie bestand is geweigerd:</p>' +
					'<ul>' + entries.join('') + '</ul>'
					+ '<p>De actieve configuratie is ongewijzigd.</p>';
				$scope.appStatus.operationResult = { level: 'error', message: $sce.trustAsHtml(resultMessage) };
			}
			$scope.$apply();
		};
	};

	$scope.restoreBackup = function() {
		$scope.appStatus.busy = true;
		$scope.appStatus.operationResult = { level: 'info', message: $sce.trustAsHtml('Vorig configuratie bestand wordt teruggezet....') };

		$http({ method: 'POST', url: '/Admin/RevertConfig' })
			.success(function (data, status, headers, config) {
				$scope.appStatus.operationResult = { level: 'info', message: $sce.trustAsHtml('Configuratie is teruggezet. Applicatie wordt opnieuw opgestart..') };
				setTimeout(function () {
					window.location.href = '/';
				}, 2000);
			})
			.error(function (data, status, headers, config) {
				// ToDo: Angular $http currently doesn't support status text :-/
				$scope.appStatus.busy = false;
				$scope.appStatus.operationResult = { level: 'error', message: $sce.trustAsHtml("Er is een fout opgetreden: " + status) };
				
			});
	};

  }]);