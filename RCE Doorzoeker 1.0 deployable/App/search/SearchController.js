
var search = angular.module('Search');

search.controller('SearchController', ['$scope', '$routeParams', '$location', '$http', '$q', 'Grouping', 'itemClassifier', 'paramHandler',

	function ($scope, $routeParams, $location, $http, $q, Grouping, itemClassifier, paramHandler) {

		var facet_expanded_values_per_page = 10;

		function updateSearchSpecFromQueryString(baseSearchSpec) {
			var queryString = null;
			var urlFragments = location.href.split("?");
			if (urlFragments.length > 1) {
				queryString = urlFragments[1];
			}

			if (queryString) {
				var querySearchSpec = paramHandler.deparam(queryString);
				if (querySearchSpec.query) {
					// param encodes spaces as + for some reason, undo this
					baseSearchSpec.query = querySearchSpec.query;
				}
				if (querySearchSpec.facetOn && querySearchSpec.facetOn) {
					baseSearchSpec.facetOn = querySearchSpec.facetOn;
				}
				if (querySearchSpec.facetExpansion) {
					baseSearchSpec.facetExpansion = querySearchSpec.facetExpansion;
				}
				//if (querySearchSpec.facetCount) {
				//	searchSpec.facetCount = querySearchSpec.facetCount;
				//}
				if (querySearchSpec.groupBy) {
					baseSearchSpec.groupBy = querySearchSpec.groupBy;
				}
				if (querySearchSpec.view) {
					baseSearchSpec.view = querySearchSpec.view;
				}
			}
		}

		$scope.changeViewstyle = function (style) {
			$scope.viewstyle = style;

			console.log('viewstyle change ' + style);

			// ToDo: Check if this is really relevant in angularjs context
			// guarantee items have loaded on expanded groupings
			for (var i = 0; i < $scope.groups.length; i++) {
				var group = $scope.groups[i];
				if (group.expanded) {
					group.guaranteeItems();
				}
			}
		};

		$scope.determineFacetCssClass = function (classification) {
			return itemClassifier.determineCssClass(classification);
		};

		$scope.runQuery = function (navigating) {
			$scope.searchSpec.view = $scope.viewstyle;
			var queryString = paramHandler.param($scope.searchSpec);

			console.log("searching " + queryString);
			$location.url("/search?" + queryString, true);

			// when on search view already no need to query (the controller init will)
			if (!navigating) {
				retrieveQueryResult();
			}
		};

		$scope.searchHandler = function (query) {
			
			$scope.searchSpec.query = query;
			$scope.runQuery();
		};

		$scope.setGroupBy = function (facet) {
			if ($scope.isGroupedBy(facet)) {
				// remove selection
				console.log("Deselecting group by from " + facet.label);
				$scope.searchSpec.groupBy = null;
			} else {
				console.log("Setting group by value to " + facet.label);
				var groupBy = {
					type: facet.type
				};
				if (facet.type === "predicate") {
					groupBy.uri = facet.predicateUri;
				}
				$scope.searchSpec.groupBy = groupBy;
			}

			// ToDo: shouldn't do this from controller.. Is it still needed?
			//$(document).scrollTop(0);

			$scope.runQuery();

			return false;
		};

		$scope.isGroupedBy = function (facet) {
			if (!$scope.searchSpec.groupBy) {
				return false;
			}

			if ($scope.searchSpec.groupBy.type === facet.type) {
				if (facet.type === "predicate") {
					if ($scope.searchSpec.groupBy.uri !== facet.predicateUri) {
						return false;
					}
				}
				return true;
			}
			return false;
		};

		$scope.isFacetSelected = function (selectedFacet, uri) {
			return $scope.lookupFacetSelection({ uri: uri, facet: { type: selectedFacet.type, predicateUri: selectedFacet.predicateUri } }) >= 0;
		};

		$scope.lookupFacetSelection = function (selectedFacet) {
			var selectedFacetCount = $scope.activeFacets.length;

			for (var i = 0; i < selectedFacetCount; i++) {
				var activeFacet = $scope.activeFacets[i];
				if (activeFacet.facet.type === selectedFacet.facet.type) {
					if (activeFacet.facet.type === "predicate" && activeFacet.facet.predicateUri !== selectedFacet.facet.predicateUri) {
						continue;
					}

					if (activeFacet.uri === selectedFacet.uri) {
						return i;
					}
				}
			}
			return -1;
		};

		$scope.isFacetExpanded = function (facet) {
			if (!$scope.searchSpec.facetExpansion) {
				return false;
			}

			if (facet.type === "predicate") {
				return $scope.searchSpec.facetExpansion.uri === facet.predicateUri;
			}

			return facet.type === $scope.searchSpec.facetExpansion.type;
		};

		$scope.expandedFacetHasPriorValues = function () {
			return $scope.searchSpec.facetExpansion.start > 0;
		};

		$scope.expandFacet = function (facet) {
			$scope.searchSpec.facetExpansion = {
				start: 0,
				count: facet_expanded_values_per_page,
				type: facet.type,
				uri: facet.predicateUri,
			};
			$scope.runQuery();
		};

		$scope.expandedFacetNext = function () {
			$scope.searchSpec.facetExpansion.start = $scope.searchSpec.facetExpansion.start + facet_expanded_values_per_page;
			$scope.runQuery();
		};

		$scope.expandedFacetPrevious = function () {
			var newPos = $scope.searchSpec.facetExpansion.start - facet_expanded_values_per_page;
			if (newPos < 0) {
				newPos = 0;
			}
			$scope.searchSpec.facetExpansion.start = newPos;
			$scope.runQuery();
		};

		$scope.changeViewstyle = function (newStyle) {
			console.log('viewstyle change ' + newStyle);
			$scope.viewstyle = newStyle;

			// guarantee items have loaded on expanded groupings
			for (var i = 0; i < $scope.groups.length; i++) {
				var group = $scope.groups[i];
				if (group.expanded) {
					group.guaranteeItems();
				}
			}
		};

		$scope.removeFacet = function (activeFacet) {
			var selected = $scope.lookupFacetSelection(activeFacet);
			if (selected >= 0) {
				console.log("removing active facet, uri:" + activeFacet.uri);
				$scope.activeFacets.splice(selected, 1);
				$scope.searchSpec.facetOn.splice(selected, 1);

				$(document).scrollTop(0);

				$scope.runQuery();
			} else {
				console.log("couldn't find facet to remove!");
			}

			return false;
		};

		$scope.selectFacet = function (facet, facetValue) {
			var uri = facetValue.uri;
			var label = facetValue.label;

			var selected = $scope.lookupFacetSelection({ uri: uri, facet: facet });

			var newFacet;
			if (selected >= 0) {
				console.log("facet is active, removing it. uri:" + uri);
				$scope.activeFacets.splice(selected, 1);
				$scope.searchSpec.facetOn.splice(selected, 1);
			} else {
				//var activeFacet = { facet: facet, uri: uri, label: label, classification: facetValue.classification };

				//$scope.activeFacets.push(activeFacet);
				$scope.searchSpec.facetOn.push({ type: facet.type, predicateUri: facet.predicateUri, uri: uri });
			}

			$(document).scrollTop(0);

			$scope.runQuery();

			return false;
		};

		$scope.reset = function() {
			$scope.searchSpec = $scope.defaultSearchSpec();
			$scope.activeFacets = [];
			$scope.runQuery();
		};
		// ---------------- INIT
		console.log("init search controller");

		$scope.groups = [];
		$scope.activeFacets = [];
		$scope.viewstyle = 'list';

		$scope.haveResults = true;

		var searchSpec = $scope.defaultSearchSpec();

		updateSearchSpecFromQueryString(searchSpec);

		console.log('launching search');

		$scope.searchSpec = searchSpec;
		$scope.viewstyle = searchSpec.view;

		function retrieveQueryResult() {
			$scope.appstate.navigating = true;

			var q = $scope.searchSpec;

			// init callback
			$scope.pagedGroupingQuery = function (groupingUri, start, count) {

				// paged queries for list and thumbnail view
				return $http.get('/search/grouping?' + $.param({
					start: start,
					count: count,
					facetOn: q.facetOn,
					query: q.query,
					groupBy: q.groupBy,
					groupingUri: groupingUri
				}));
			};

			$scope.mapGroupingQuery = function (groupingUri, viewport) {
				// non-paged query for map view (requires lat-long coordinates)
				return $http.get('/search/groupingMap?' + $.param({
					facetOn: q.facetOn,
					query: q.query,
					groupBy: q.groupBy,
					groupingUri: groupingUri,
					topLeft: viewport.topLeft,
					bottomRight: viewport.bottomRight
				}));
			};

			var groupsQuery = $http.get('/search/groups?' + $.param({
				query: q.query,
				facetOn: q.facetOn,
				groupBy: q.groupBy,
			}))
			.success(function (data) {
				$scope.groups = data.groups.map(function (item) {
					return new Grouping(item, $scope);
				});

				$scope.haveResults = data.groups.length > 0;
			});

			var facetsQuery = $http.get('/search/facets?' + $.param({
				query: q.query,
				facetOn: q.facetOn,
				facetExpansion: q.facetExpansion,
				facetCount: q.facetCount,
				groupBy: q.groupBy,
			}))
			.success(function (facetData) {
				$scope.facets = facetData.facets || [];
				$scope.activeFacets = facetData.activeFacets || [];

				$scope.searchSpec.facetOn = [];

				if (facetData.activeFacets) {
					for (var facetIndex = 0; facetIndex < facetData.activeFacets.length; facetIndex++) {
						var activeFacet = facetData.activeFacets[facetIndex];
						$scope.searchSpec.facetOn.push({ type: activeFacet.facet.type, uri: activeFacet.uri, predicateUri: activeFacet.facet.predicateUri });
					}
				}

				if ($scope.searchSpec.facetExpansion) {
					$scope.searchSpec.facetExpansion.start = facetData.expandedFacetStart;
				}
			});

			$q.all([groupsQuery, facetsQuery])
				.then(function() {
					console.log('query completed');

					$scope.appstate.navigating = false;
				});
		}

		retrieveQueryResult();
	}
]);
