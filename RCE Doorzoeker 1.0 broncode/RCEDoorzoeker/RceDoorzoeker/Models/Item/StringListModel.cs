using System.Collections.Generic;

namespace RceDoorzoeker.Models.Item
{
	public class StringListModel
	{
		public IEnumerable<string> StringValues { get; set; }

		public ResourceValueModel Caption { get; set; }
	}
}