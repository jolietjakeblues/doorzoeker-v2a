using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web.UI.WebControls;
using NUnit.Framework;
using RceDoorzoeker.Services.Querying;

namespace RceDoorzoeker.Tests
{
	[TestFixture]
	public class XmlReaderItemResultParserTests
	{
		[Test]
		public void ShouldParseItems()
		{
			// arrange
			
			var xmlStream = new FileStream(Path.Combine(TestFileHelper.GetAppDir(), "large_map_result.xml"), FileMode.Open, FileAccess.Read, FileShare.Read);
			var parser = new XmlReaderItemResultParser(xmlStream);
			//var testReader = new StreamReader(xmlStream);
			//Debug.Write(testReader.ReadToEnd());

			// act
			var result = parser.ParseItems();
			
			xmlStream.Close();

			// assert
			Assert.AreEqual(424, result.Items.Count);
			var anItemResult = result.Items.First();
			Assert.AreEqual("http://www.rnaproject.org/data/9fadc062-b7bf-407e-8f8d-722c9725578b", anItemResult.Uri);
			Assert.AreEqual("Molen, rijksmonument 24539 - Balkendster Poldermolen", anItemResult.Name);
			Assert.AreEqual("http://www.rnaproject.org/data/d542b559-e906-499f-90cb-7739ab0eadea", anItemResult.ItemTypeUri);
			Assert.AreEqual(53.28396725, anItemResult.Coordinate.Latitude, 0.00000001);
			Assert.AreEqual(5.73757358, anItemResult.Coordinate.Longitude, 0.00000001);
			Assert.AreEqual("Molen, rijksmonument 24539 - Balkendster Poldermolen", anItemResult.Labels[0].Value);
			Assert.AreEqual("sys", anItemResult.Labels[0].Language);
			Assert.AreEqual("Molen, rijksmonument 24539 - Balkendster Poldermolen", anItemResult.Labels[1].Value);
			Assert.AreEqual("dut", anItemResult.Labels[1].Language);
			
			anItemResult = result.Items.Skip(1).First();
			Assert.AreEqual("http://www.rnaproject.org/data/a6cf33d6-b4a3-4246-b45f-31325d3a8147", anItemResult.Uri);
			Assert.AreEqual("Molen, rijksmonument 33096 - Poldermolen E", anItemResult.Name);
			Assert.AreEqual("http://www.rnaproject.org/data/d542b559-e906-499f-90cb-7739ab0eadea", anItemResult.ItemTypeUri);
			Assert.AreEqual(52.61686147, anItemResult.Coordinate.Latitude, 0.00000001);
			Assert.AreEqual(4.80965861, anItemResult.Coordinate.Longitude, 0.00000001);
			Assert.AreEqual("Molen, rijksmonument 33096 - Poldermolen E", anItemResult.Labels[0].Value);
			Assert.AreEqual("sys", anItemResult.Labels[0].Language);
			Assert.AreEqual("Molen, rijksmonument 33096 - Poldermolen E", anItemResult.Labels[1].Value);
			Assert.AreEqual("dut", anItemResult.Labels[1].Language);
		}
	}
}
