using System.Collections.Generic;
using RceDoorzoeker.Models.Item;

namespace RceDoorzoeker.Models.Search
{
	public class ClusteredMapResultModel
	{
		public IList<ResourceValueModel> Items { get; set; }
		public IList<ClusterModel> Clusters { get; set; }
		public int TotalCount { get; set; }
		public bool TooManyResults { get; set; }
	}
}