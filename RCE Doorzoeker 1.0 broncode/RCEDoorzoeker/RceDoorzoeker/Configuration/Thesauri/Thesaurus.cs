using System.Xml.Serialization;

namespace RceDoorzoeker.Configuration.Thesauri
{
	public class Thesaurus
	{
		[XmlAttribute]
		public bool Enabled { get; set; }

		[XmlAttribute]
		public string Name { get; set;  }
		
		[XmlAttribute]
		public string Uri { get; set; }

	}
}