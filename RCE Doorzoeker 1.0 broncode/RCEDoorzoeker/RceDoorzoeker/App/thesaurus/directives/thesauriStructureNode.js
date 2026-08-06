angular.module("Thesaurus")
	.directive("dzThesauriStructureNode", ['$compile',
		function ($compile) {
			return {
				restrict: "E",
				templateUrl: 'App/thesaurus/directives/thesauriStructureNode.html',
				replace: true,
				scope: {
					node: '=',
					selected: "="
				},
				link: function(scope, element, attr) {
					if (scope.node.nodes) {
						// ToDo: cache compiled template
						$compile('<dz:thesauri-structure-nodes nodes="node.nodes" selected="selected" />')(scope, function (cloned) {
							var insertElement = element.find('.child-nodes');
							insertElement.append(cloned);
						});
					}

					scope.isSelected = function(uri) {
						//console.log('selected:' + scope.selected);
						return scope.selected === uri;
					};
				}
			};
		}
	]);