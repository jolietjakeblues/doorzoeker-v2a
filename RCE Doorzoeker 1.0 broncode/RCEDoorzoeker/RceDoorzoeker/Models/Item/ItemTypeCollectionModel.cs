using System.Collections.Generic;

namespace RceDoorzoeker.Models.Item
{
	public class ItemTypeCollectionModel
	{
		public string Label { get; set; }
		public IEnumerable<ResourceValueModel> ItemType { get; set; }
	}
}