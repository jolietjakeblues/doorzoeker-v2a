using System.Collections.Generic;

namespace RceDoorzoeker.Models.Search
{
	public class FacetResultModel
	{
		public FacetModel Facet { get; internal set; }
		public IList<FacetValueModel> FacetValues { get; internal set; }
		public bool HasMoreValues { get; set; }
	}
}