using System.Collections.Generic;

namespace RceDoorzoeker.Models.Item
{
	public class ItemPositionModel
	{
		public IEnumerable<StructureNodeModel> Path { get; set; }
		public IEnumerable<StructureNodeModel> Children { get; set; }
	}
}