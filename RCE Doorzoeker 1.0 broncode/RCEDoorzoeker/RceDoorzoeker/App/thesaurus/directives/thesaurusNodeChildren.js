angular.module("Thesaurus")
	.directive("dzThesaurusNodeChildren", [
		function () {
			return {
				restrict: "E",
				templateUrl: 'App/thesaurus/directives/thesaurusNodeChildren.html',
				replace: true,
				scope: {
					nodes: '=',
				},
				link: function (scope, element, attr) {

				}
			};

		}
	]);