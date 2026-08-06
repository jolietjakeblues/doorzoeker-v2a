using System.Collections.Generic;
using RceDoorzoeker.Models.Item;

namespace RceDoorzoeker.Models.Search
{
	public class GroupingItemsModel
	{
		public IList<ResourceValueModel> Items { get; set; }
		public int TotalCount { get; set; }
		public int Start { get; set; }
	}
}