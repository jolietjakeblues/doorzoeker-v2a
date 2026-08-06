using System.Collections.Generic;

namespace RceDoorzoeker.Models.Item
{
	public class InfoWindowModel
	{
		public string Uri { get; set; }

		public ResourceValueModel ReferenceStructure { get; set; }

		public string ItemPrefLabel { get; set; }

		public ItemClassification Classification { get; set; }

		//public ResourceValueModel ItemTypeResource { get; set; }

		public IEnumerable<StatementModel> Statements { get; set; }
	}
}