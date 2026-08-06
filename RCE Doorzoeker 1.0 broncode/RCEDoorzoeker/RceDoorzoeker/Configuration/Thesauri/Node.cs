using System;
using System.Collections.Generic;
using System.Xml.Serialization;

namespace RceDoorzoeker.Configuration.Thesauri
{
	public class Node
	{
		// due to limitation of the XmlSerializer and interfaces, thesaurus will/should be null if there are any nodes and vice versa

		[XmlAttribute]
		public string Name { get; set; }

		public List<Thesaurus> Thesauri { get; set; }

		public List<Node> Nodes { get; set; }
	}
}