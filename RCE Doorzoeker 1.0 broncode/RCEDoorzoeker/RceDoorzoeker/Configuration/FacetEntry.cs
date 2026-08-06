using System.Xml.Serialization;
using RceDoorzoeker.Services;

namespace RceDoorzoeker.Configuration
{
	public class FacetEntry
	{
		[XmlAttribute]
		public bool Enabled { get; set; }

		[XmlAttribute]
		public string Name { get; set; }
		
		[XmlAttribute]
		public FacetType FacetType { get; set; }
		
		[XmlAttribute]
		public string PredicateUri { get; set; }
	}
}