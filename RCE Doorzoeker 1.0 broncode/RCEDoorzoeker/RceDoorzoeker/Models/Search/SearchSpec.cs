using System.Collections.Generic;

namespace RceDoorzoeker.Models.Search
{
	public class SearchSpec
	{
		public int Start { get; set; }
		public int Count { get; set; }
		public string Query { get; set; }
		public GroupByModel GroupBy { get; set; }
		public List<FacetFilterModel> FacetOn { get; set; }
	}
}