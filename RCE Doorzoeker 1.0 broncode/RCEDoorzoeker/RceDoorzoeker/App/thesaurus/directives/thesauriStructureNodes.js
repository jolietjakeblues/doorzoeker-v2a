// We need a separate directive for the collection or AngularJs can't handle the recursion (infinite loop)
angular.module("Thesaurus")
	.directive("dzThesauriStructureNodes", [
		function () {
			return {
				restrict: "E",
				templateUrl: 'App/thesaurus/directives/thesauriStructureNodes.html',
				replace: true,
				scope: {
					nodes: '=',
					selected: "="
				},
				link: function (scope, element, attr) {
					
				}
			};

		}
	]);