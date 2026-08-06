using System.Collections.Generic;

namespace RceDoorzoeker.Models.Thesaurus
{
	public class ThesauriNodeModel
	{
		public string Name { get; set; }
		public List<ThesauriNodeModel> Nodes { get; set; }
		public List<ThesaurusModel> Thesauri { get; set; } 
	}
}