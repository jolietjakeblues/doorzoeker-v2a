using System.Collections.Generic;
using RceDoorzoeker.Models.Item;

namespace RceDoorzoeker.Models.Search
{
	public class SearchFacetsModel
	{
		public string Query { get; set; }
		
		public IReadOnlyCollection<FacetResultModel> Facets { get; set; }

		public int ExpandedFacetStart { get; set; }
		public List<ActiveFacetModel> ActiveFacets { get; set; }
	}

	public class ActiveFacetModel
	{
		public FacetModel Facet { get; internal set; }

		public string Uri { get; set; }
		public string Label { get; set; }
		
		public ItemClassification Classification { get; set; }
	}
}