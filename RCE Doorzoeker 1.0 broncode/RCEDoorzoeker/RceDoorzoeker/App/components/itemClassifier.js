var components = angular.module('Components');

components.service('itemClassifier', function() {

	var ResourceClassification = {
		'thesaurusterm': 1,
		'bronrecord': 2,
	};

	this.determineCssClass = function(classification) {
		var cssClass;
		if (!classification) {
			return 'unclassified-resource';
		}
		switch (classification) {
			case ResourceClassification['thesaurusterm']:
				cssClass = 'thesaurusterm-resource';
				break;
			case ResourceClassification['bronrecord']:
				cssClass = 'bronrecord-resource';
				break;
			default:
				console.log('Unknown resource classification value: ' + classification);
				cssClass = 'unclassified-resource';
				break;
		}
		return cssClass;
	};

});