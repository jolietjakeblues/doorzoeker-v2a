'use strict';

angular.module('Components', []);
angular.module('Search', ['Components']);
angular.module('Item', ['Search']);
angular.module('Thesaurus', ['Search', 'Components']);

var app = angular.module('App', ['ngRoute', 'Search', 'Item', 'Thesaurus']);

app.config(['$logProvider', function ($logProvider) {
	$logProvider.debugEnabled(true);
}]);

app.config(['$routeProvider',
  function ($routeProvider) {
	$routeProvider
	.when('/search', {
		templateUrl: '/App/search/search.html',
		controller: 'SearchController',
		reloadOnSearch: false,
	})
	.when('/item', {
		templateUrl: '/App/item/item.html',
		controller: 'ItemController'
	})
	.when('/thesaurus', {
		templateUrl: '/App/thesaurus/thesaurus.html',
		controller: 'ThesaurusController'
	})
	.otherwise({
		redirectTo: '/search'
	});
  }]);

app.run(function () {
	/* console shim*/
	(function () {
		var f = function () { };
		if (!window.console) {
			window.console = {
				log: f, info: f, warn: f, debug: f, error: f
			};
		}
	}());
});
