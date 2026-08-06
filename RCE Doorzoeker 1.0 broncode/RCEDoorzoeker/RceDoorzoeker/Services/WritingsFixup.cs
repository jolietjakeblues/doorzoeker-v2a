using System;
using System.IO;
using System.Xml.Linq;
using System.Xml.XPath;
using RceDoorzoeker.Configuration;
using Trezorix.RnaRemote.Core.ContentItems;

namespace RceDoorzoeker.Services
{
	public class WritingsFixup
	{
		public static string FixupWriting(ContentItem contentItem)
		{
			// ToDo: Perhaps fix this in RnaRemote? 
			if (contentItem.Writing == "<body />")
			{
				return null;
			}

			var xDoc = XDocument.Load(new StringReader(contentItem.Writing));

			string contentId = ExtractGuid(contentItem.Uri);

			FixupWritingLinks(contentId, xDoc);
			
			return xDoc.ToString();
		}

		private static void FixupWritingLinks(string uri, XDocument writing)
		{

			FixAnchors(writing);

			var internalFormat = string.Format("{0}/Media/Image/{1}/{{0}}", DoorzoekerConfig.Current.RnaToolsetConfig.BaseUrl,
				uri);
			
			FixImages(writing, internalFormat);
		}

		private static void FixAnchors(XDocument xDoc)
		{
			var links = xDoc.XPathSelectElements("//a[@class='sitelink']");
			foreach (var link in links)
			{
				var hrefAttribute = link.Attribute("href");
				var uri = hrefAttribute.Value;
				hrefAttribute.Value = string.Format("/Item?uri={0}", uri);
			}
		}

		private static void FixImages(XDocument xDoc, string internFormat)
		{
			var images = xDoc.XPathSelectElements("//img[@class='intern' or not(starts-with(@src, 'http'))]");
			foreach (var img in images)
			{
				var hrefAttribute = img.Attribute("src");
				var src = hrefAttribute.Value;
				hrefAttribute.Value = string.Format(internFormat, src);
			}
		}

		private static string ExtractGuid(string uri)
		{
			int strIndex = uri.LastIndexOf("/");
			if (strIndex >= 0)
			{
				string guidString = uri.Substring(strIndex + 1);
				Guid guid;
				if (Guid.TryParse(guidString, out guid))
				{
					return guidString;
				}
			}
			return null;
		}
	}
}