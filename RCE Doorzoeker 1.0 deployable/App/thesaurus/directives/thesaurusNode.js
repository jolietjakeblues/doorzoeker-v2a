angular.module("Thesaurus")
	.directive("dzThesaurusNode", ['$compile', '$http', 'NodeHandler',
		function ($compile, $http, NodeHandler) {
			var compiled = null;
			return {
				restrict: "E",
				templateUrl: 'App/thesaurus/directives/thesaurusNode.html',
				scope: {
					node: '=',
				},
				link: function ($scope, element, attr) {
					if (compiled === null) {
						compiled = $compile('<dz:thesaurus-node-children nodes="node.children" />');
					}
					
					compiled($scope, function (cloned) {
						var insertElement = element.find('.child-node-list');
						insertElement.append(cloned);
					});

					$scope.NodeHandler = NodeHandler;
				}
			};

		}
	]);