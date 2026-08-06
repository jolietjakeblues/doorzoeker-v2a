using RceDoorzoeker.Models.Item;

namespace RceDoorzoeker.Models.Search
{
	public class FacetValueModel
	{
		public string Uri { get; set; }
		public string Label { get; set; }
		public int Count { get; set; }
		public ItemClassification Classification { get; set; }
	}
}