using System.Collections.Generic;

namespace RceDoorzoeker.Services.Querying
{
	public class FacetResult
	{
		public Facet Facet { get; internal set; }
		public IList<FacetValue> FacetValues { get; internal set; }
		public bool HasMoreValues { get; set; }
	}
}