using RceDoorzoeker.Services.Querying;

namespace RceDoorzoeker.Models.Search
{
	public class ViewportSearchGroupingItemsSpec : SearchGroupingItemsSpec
	{
		public LatLong TopLeft { get; set; }
		public LatLong BottomRight { get; set; }
	}
}