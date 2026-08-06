using System.Collections.Generic;

namespace RceDoorzoeker.Models.Item
{
	public class ContentItemModel : ItemModel
	{
		public ResourceValueModel ItemTypeResource { get; set; }

		public IEnumerable<StatementModel> Statements { get; set; }
		public string Writing { get; set; }
		public bool IsAnnexItem { get; set; }

	}
}