using RceDoorzoeker.Services.Querying;

namespace RceDoorzoeker.Models.Item
{
	public class ItemViewModel
	{
		public string Classification { get; set; }
		public ItemPositionModel Position { get; set; }
		public LatLong Coordinate { get; set; }
	}
}