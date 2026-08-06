angular.module("Item")
	.directive('dzItemMap', [
		'$http', '$location', '$timeout',
		function ($http, $location, $timeout) {
			return {
				restrict: 'E',
				templateUrl: '/App/item/directives/itemMap.html',
				scope: true,
				link: function($scope, element) {
					
					if ($scope.coordinate) {
						$scope.loading = true;
						console.log('attached map');
						var markerPoint = new google.maps.LatLng($scope.coordinate.latitude, $scope.coordinate.longitude);

						var mapOptions = {
							center: markerPoint,
							zoom: 12
						};
						$scope.map = new google.maps.Map(element.find('.map')[0], mapOptions);
						$scope.marker = new google.maps.Marker({
							position: markerPoint,
							map: $scope.map,
							clickable: false
						});

						// using timeout as a poor man's 'after render'
						$timeout(function () {
							console.log('composed, resizing map.');
							google.maps.event.trigger($scope.map, 'resize');
							$scope.loading = false; // ToDo: Attach a google maps 'idle' event?
						});
					}
				}
			};
		}
	]);