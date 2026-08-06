using RceDoorzoeker.Services.Querying;

namespace RceDoorzoeker.Models.Search
{
	public class ClusterModel
	{
		public LatLong Center { get; set; }
		public int Count { get; set; }
		public double Radius { get; set; }
	}
}