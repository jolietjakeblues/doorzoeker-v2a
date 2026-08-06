angular.module('Search')
	.directive('dzResultMap', ['$timeout',
	function($timeout) {
		
		return {
			restrict: 'E',
			scope: {
				queryObject: '='
			},
			templateUrl: '/App/search/directives/resultMap.html',
			link: function($scope, element) {

				console.log('linking dzResultMap');

				var infoWindow = new google.maps.InfoWindow({
					maxWidth: 400,
				});

				function markerClickHandler(event) {

					console.log('marker clicked');
					var marker = this;

					infoWindow.close();

					$.get("/infowindow/?uri=" + this.uri)
						.success(function (html) {
							infoWindow.setContent(html);
						})
						.fail(function (jqXHR, textStatus, errorThrown) {
							// ToDo: betere fout afhandeling
							infoWindow.setContent("<div class='error'>Kon item niet ophalen. Er is een fout opgetreden:<div class='message'>" + errorThrown + "</div></div>");
						})
						.always(function () {
							infoWindow.open(marker.getMap(), marker);
						});
				}

				$scope.clusters = null;
				$scope.markers = {};
				$scope.subscription = null;

				function renderResults(result) {
					console.log('rendering result on map');
					renderClusters(result.clusters);
					renderUnclustered(result.items);
				}

				function renderClusters(clusters) {
					var i;
					if ($scope.clusters) {
						for (i = 0; i < $scope.clusters.length; i++) {
							$scope.clusters[i].setMap(null);
						}
					}
					var newClusters = [];
					for (i = 0; i < clusters.length; i++) {
						var cluster = clusters[i];
						var clusterOptions = {
							strokeColor: '#FF0000',
							strokeOpacity: 0.8,
							strokeWeight: 2,
							fillColor: '#FF0000',
							fillOpacity: 0.35,
							map: $scope.map,
							center: new google.maps.LatLng(cluster.center.latitude, cluster.center.longitude),
							radius: cluster.radius * 75000,
							clickable: false,
						};
					
						newClusters.push(new google.maps.Circle(clusterOptions));
					}

					$scope.clusters = newClusters;
				}

				function renderUnclustered(newItems) {
					var item, i;

					var newMarkers = {};

					var newCount = 0;
					var existingCount = 0;
					var existing;
					var uri;

					for (uri in $scope.markers) {
						if ($scope.markers.hasOwnProperty(uri)) {
							$scope.markers[uri].reused = false;
						}
					}

					// add new markers
					for (i = 0; i < newItems.length; i++) {
						item = newItems[i];
						existing = $scope.markers[item.link];
						if (existing == null) {
							newCount++;
							var marker = new google.maps.Marker({
								position: new google.maps.LatLng(item.coordinate.latitude, item.coordinate.longitude),
								map: $scope.map,
								title: item.label,
								uri: item.link,
							});

							google.maps.event.addListener(marker, 'click', markerClickHandler);

							newMarkers[item.link] = marker;

							// remove this marker from the old collection
							delete $scope.markers[item.link];

						} else {
							existingCount++;
							newMarkers[item.link] = existing;
							existing.reused = true;
						}

					}

					var removeCount = 0;
					// remove markers that are no-longer used
					for (uri in $scope.markers) {
						if (!$scope.markers[uri].reused) {

							$scope.markers[uri].setMap(null);
							removeCount++;
						}
					}

					$scope.markers = newMarkers;

					console.log('existing ' + existingCount + ', new ' + newCount + ', removed ' + removeCount + ' markers.');
				}

				// ---- attach map
				
				// $timeout as a sort of 'dom ready'
				$timeout(function () {

					console.log('attached map');
					function createMap() {
						return new google.maps.Map(element.find('.map')[0], {
							center: new google.maps.LatLng(52.225351, 5.332368),
							zoom: 7
						});
					}

					$scope.map = createMap();
					$scope.refreshMapWhenIdle = false;

					google.maps.event.addListener($scope.map, 'idle', function () {
						console.log("map idle");
						if ($scope.refreshMapWhenIdle) {
							$scope.refreshMapWhenIdle = false;

							var bounds = $scope.map.getBounds();
							var ne = bounds.getNorthEast();
							var sw = bounds.getSouthWest();

							var viewport = {
								topLeft: { latitude: sw.lat(), longitude: ne.lng() },
								bottomRight: { latitude: ne.lat(), longitude: sw.lng() }
							};

							$scope.queryObject.viewport = viewport;
							$scope.queryObject.queryItems();
						}
					});

					google.maps.event.addListener($scope.map, 'bounds_changed', function () {
						$scope.refreshMapWhenIdle = true;
					});

					// subscribe to the queryObject which may be invoked externally (by expanding the result group etc)
					$scope.$watch("queryObject.result", function (result) {
						console.log('items data changed event');
						if (result) {
							renderResults(result);
						}
					});

					//$scope.$watch("grouping.expanded", function (newVal, oldVal) {
					//google.maps.event.trigger($scope.map, 'resize');
					//});

					$scope.$on('$destroy', function () {
						console.log('detached resultMap');
						google.maps.event.clearInstanceListeners($scope.map);
					});

					console.log('composed, resizing map.');
					google.maps.event.trigger($scope.map, 'resize');
				});
			}
 
		};
	}
]);
