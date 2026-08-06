angular.module('Thesaurus')
	.controller('ThesaurusController', ['$scope', '$http', '$q', '$location', 'NodeHandler',
	function($scope, $http, $q, $location, NodeHandler) {

		$scope.appstate.navigating = true;

		function findThesaurus(thesauri, predicate) {
			for (var i = 0; i < thesauri.length; i++) {
				if (predicate(thesauri[i])) {
					return thesauri[i];
				}
			}
			return null;
		}

		function seekThesaurus(node, predicate) {
			var found;
			var thesauri = node.thesauri;

			if (thesauri && thesauri.length) {
				found = findThesaurus(thesauri, predicate);
				if (found) {
					return found;
				}
			}

			if (node.nodes && node.nodes.length) {
				for (var i = 0; i < node.nodes.length; i++) {
					found = seekThesaurus(node.nodes[i], predicate);
					if (found) {
						return found;
					}
				}
			}

			return null;
		}

		function createRootNode(thesauri) {
			return {
				value: {
					isUnresolved: false,
					link: thesauri.uri,
					label: thesauri.name,
					isInRecycleBin: false
				},
				currentPage: 1,
				pages: null,
				hasChildren: true,
				children: null,
				expanded: false,
				loadingChildren: false,
				selected: false
			};
		}

		$scope.rootNode = null;
		$scope.selected = null;

		$scope.thesauri = null;
		$scope.itemPath = null;

		console.log('thesaurus activate');

		var thesauriTreeLoader = $http.get('/thesaurus/thesauriroot')
			.success(function(data) {
				console.log('thesaurus structure loaded.');
				$scope.thesauri = data;
				return true;
			});

		var itemPathLoader;
		var queryInput = $location.search();

		// if we are to display a specific item in the thesaurus load it's path
		if (queryInput && queryInput.uri) {
			itemPathLoader = $http.get('/thesaurus/itempath?uri=' + queryInput.uri)
				.success(function(data) {
					console.log('thesaurus item path loaded.');
					return data;
				})
				.error(function() {
					return null;
				});

		} else {
			// otherwise set a do nothing promise
			itemPathLoader = null;
		}

		// if one is set, the itemPath determines the selected structure
		$q.all([thesauriTreeLoader, itemPathLoader])
			.then(function(result) {

				var itemPathData = result[1];
				var itemPath = itemPathData != null ? itemPathData.data : null;
				console.log('determining structure selection');

				// if no root node was set (by the itemPathLoader) we'll grab the first structure
				var structure = null;
				if (itemPath) {
					structure = getThesaurusByUri(itemPath.structure);
					itemPath.nodes.shift();
				}
				if (!structure) {
					structure = findDefaultThesaurus();
				}

				if (structure) {
					$scope.selected = structure.uri;
					var structureNode = createRootNode(structure);
					$scope.rootNode = structureNode;

					NodeHandler.expand(structureNode, itemPath);
				} else {
					console.warn('could not find structure for this path');
				}

				$scope.appstate.navigating = false;
			});

		function getThesaurusByUri(uri) {
			return seekThesaurus($scope.thesauri, function(thesaurus) { return thesaurus.uri === uri; });
		}

		function findDefaultThesaurus() {
			return seekThesaurus($scope.thesauri, function(thesaurus) { return thesaurus.uri; });
		}

	}
]);
