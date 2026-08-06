using System.Collections.Generic;

namespace RceDoorzoeker.Models.Item
{
	public class ChildrenResultModel
	{
		public IEnumerable<ChildItemModel> Items { get; set; }
		
		public int TotalResults { get; set; }

		public int Start { get; set; }

		public int Count { get; set; }
	}
}