using System.Xml.Serialization;

namespace RceDoorzoeker.Configuration
{
	public class MapCoordinatePredicateConfig
	{
		[XmlAttribute]
		public string Lat { get; set; }
		
		[XmlAttribute]
		public string Long { get; set; }
	}
}