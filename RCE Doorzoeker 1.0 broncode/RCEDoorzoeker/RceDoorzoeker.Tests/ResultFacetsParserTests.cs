using System;
using System.IO;
using System.Text.RegularExpressions;
using System.Xml.XPath;
using NUnit.Framework;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Services;
using RceDoorzoeker.Services.Querying;
using Trezorix.RnaRemote;
using Trezorix.RnaRemote.RepositoryBase;

namespace RceDoorzoeker.Tests
{
	[TestFixture]
	public class ResultFacetsParserTests
	{
		private readonly XPathDocument _xml;
		private FacetsResultParser _facetsParser;

		public ResultFacetsParserTests()
		{
			var testFile = Path.Combine(Environment.CurrentDirectory, "facetList.xml");

			var regEx = new Regex("<solrQuery>.*?</solrQuery>");
			
			var content = regEx.Replace(File.ReadAllText(testFile), string.Empty);

			_xml = new XPathDocument(new StringReader(content));

		}

		[SetUp]
		public void Setup()
		{
			// arrange
			var connector = new RnaApiConnector(DoorzoekerConfig.Current.RnaToolsetConfig.BaseUrl, DoorzoekerConfig.Current.RnaToolsetConfig.ApiKey);
			var context = RnaContext.OpenCoreModelOnly(connector);
			var session = context.StartSession();

			var model = new FacetRegistry((IItemStore) session.ItemRepository);

			_facetsParser = new FacetsResultParser(model);
		}

		[Test]
		public void Parse()
		{
			// arrange
			
			// act
			var result = _facetsParser.Parse(_xml);

			// assert
			Assert.That(result.Count, Is.EqualTo(6));
			foreach (var facet in result)
			{
				Assert.That(facet.Facet, Is.Not.Null);
				Assert.That(facet.Facet.FieldName, Is.Not.Null);
				if (facet.Facet.Type != FacetType.ItemType)
				{
					Assert.That(facet.Facet.Predicate, Is.Not.Null);					
				}
				Assert.That(facet.FacetValues.Count, Is.AtLeast(1));
			}
			
		}
		
	}
}