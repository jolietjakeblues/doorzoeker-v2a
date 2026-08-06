using System.Collections.Generic;

namespace RceDoorzoeker.Models.Thesaurus
{
	public class ItemPathModel
	{
		public string Structure { get; set; }
		public string Uri { get; set; }
		public IList<ItemPathNode> Nodes { get; set; }

		public ItemPathModel()
		{
			Nodes = new List<ItemPathNode>();
		}
	}
}