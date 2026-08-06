using System.IO;
using System.Text.RegularExpressions;
using System.Xml.XPath;
using Trezorix.RnaRemote;

namespace RceDoorzoeker.Services.RnaApiClient
{
	public class LocalWebApiV1Client : BaseWebApiV1Client
	{
		public LocalWebApiV1Client(RnaApiConnector apiConnector) : base(apiConnector)
		{
		}

		public XPathDocument GetDirectSolrSearchResult(string query)
		{
			const string request_command = "/api/directsolrsearch.aspx";
			var result = ApiCall<string>(request_command, query);

			// ToDo: Check what's happening here, on the other end this value is written using InnerText which should be save..
			var regEx = new Regex("<solrQuery>.*?</solrQuery>");
			result = regEx.Replace(result, string.Empty);

			var xPathDoc = new XPathDocument(new StringReader(result));

			return xPathDoc;
		}

	}
}