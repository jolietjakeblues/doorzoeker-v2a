using System.Collections.Generic;
using RceDoorzoeker.Services.Querying;

namespace RceDoorzoeker.Services.MapItemClustering
{
	public class ClusteredItems
	{
		public List<Cluster> Clusters { get; set; }
		public List<SearchResultItem> Points { get; set; }
		public int TotalCount { get; set; }
		public bool TooManyResults { get; set; }
	}
}