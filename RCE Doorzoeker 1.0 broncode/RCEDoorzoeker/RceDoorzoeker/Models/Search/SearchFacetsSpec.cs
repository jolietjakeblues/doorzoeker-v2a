using RceDoorzoeker.Controllers;

namespace RceDoorzoeker.Models.Search
{
	public class SearchFacetsSpec : SearchSpec
	{
		public SearchFacetsSpec()
		{
			FacetCount = 10;
		}

		public FacetExpansionModel FacetExpansion { get; set; }

		public int FacetCount { get; set; }
	}
}