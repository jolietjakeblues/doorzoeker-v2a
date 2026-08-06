angular.module('Item')
	.controller('ItemController', [
		'$scope', '$location', '$http', '$sce', '$q', 'ReferrerGrouping', 'MapResultQueryObject',
		function ($scope, $location, $http, $sce, $q, ReferrerGrouping, MapResultQueryObject) {

			$scope.appstate.navigating = true;

			$scope.uri = $location.search().uri;
			$scope.textualReferrerGroups = null;
			$scope.groups = null;
			$scope.showPosition = false;

			$scope.itemView = null;
			
			$scope.position = null;
			$scope.path = null;
			$scope.coordinate = null;

			$scope.view = 'images';

			// ToDO: Still needed?
			//$(document).scrollTop(0);

			// init callback
			var groupingQuery = function (groupingUri, start, count) {
				return $http.get('/item/ListGroupingReferrers?uri=' + $scope.uri + '&groupingUri=' + groupingUri + '&start=' + start + '&count=' + count);
			};

			// init callback
			var textualReferrerGroupingQuery = function (groupingUri, start, count) {
				return $http.get('/item/ListGroupingTextualReferrers?uri=' + $scope.uri + '&groupingUri=' + groupingUri + '&start=' + start + '&count=' + count);
			};

			var referrerMapQuery = function(viewport) {
				return $http.get('/item/ReferrerMap?' + $.param({
					uri: $scope.uri,
					topLeft: viewport.topLeft,
					bottomRight: viewport.bottomRight
				}));
			};

			$scope.mapResultQueryObject = new MapResultQueryObject(referrerMapQuery, $scope.uri);

			$scope.indent = function(depth) {
				return (depth * 8).toString() + 'px';
			};

			var itemInfoLoader = $http.get('/item/itemviewdata?uri=' + $scope.uri)
				.success(function (data) {
					//console.log('position path length: ' + data.position.path.length);
					
					$scope.position = data.position;

					$scope.path = data.position.path.slice(0, data.position.path.length - 1);

					if (data.classification === 'thesaurusterm') {
						$scope.showPosition = true;
						$scope.isThesaurusterm = true;
					} else {
						$scope.showPosition = false;
						$scope.isThesaurusterm = false;
					}

					$scope.coordinate = data.coordinate;
				});

			var htmlLoader = $http.get("/itemview?uri=" + $scope.uri)
				.success(function (html) {
					$scope.itemView = $sce.trustAsHtml(html);
				});

			$http.get('/item/ListReferrerGroupings?uri=' + $scope.uri)
				.success(function (data) {
					$scope.groups = data.map(function (item) {
						return new ReferrerGrouping(item, groupingQuery);
					});
				});

			$http.get('/item/ListTextualReferrerGroupings?uri=' + $scope.uri)
				.success(function (data) {
					$scope.textualReferrerGroups = data.map(function (item) {
						return new ReferrerGrouping(item, textualReferrerGroupingQuery);
					});
				});

			$scope.setImagesView = function () {
				$scope.view = 'images';
				return false;
			};

			$scope.setLiteratureView = function () {
				$scope.view = 'literature';
				return false;
			};

			$scope.setMapView = function () {
				$scope.view = 'map';
				return false;
			};

			$scope.isImagesView = function () {
				return $scope.view === "images";
			};

			$scope.isLiteratureView = function () {
				return $scope.view === "literature";
			};

			$scope.isMapView = function () {
				return $scope.view === "map";
			};

			// wait till the html arrived
			$q.all([htmlLoader, itemInfoLoader]).then(function() {
				$scope.appstate.navigating = false;
			});

		}
	]);