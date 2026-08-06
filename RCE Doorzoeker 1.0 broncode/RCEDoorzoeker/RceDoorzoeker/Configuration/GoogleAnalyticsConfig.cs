using System.Xml.Serialization;

namespace RceDoorzoeker.Configuration
{
	public class GoogleAnalyticsConfig
	{
		[XmlAttribute]
		public string Code { get; set; }
		
		[XmlAttribute]
		public string Website { get; set; }
	}
}