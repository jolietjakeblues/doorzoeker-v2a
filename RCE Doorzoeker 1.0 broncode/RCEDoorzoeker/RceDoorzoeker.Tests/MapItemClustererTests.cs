using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using RceDoorzoeker.Services.MapItemClustering;

namespace RceDoorzoeker.Tests
{
	[TestFixture]
	public class MapItemClustererTests
	{
		[Test]
		public void Empty_list_returns_empty_list()
		{
			// arrange
			var points = new List<MapPoint>();

			var clusterer = new MapItemClusterer();
			
			// act
			
			var result = clusterer.CollectClusteredItems(points, 1);

			// assert
			Assert.That(result, Is.InstanceOf<IList<Cluster>>());
			Assert.That(result.Count, Is.EqualTo(0));

		}

		[Test]
		public void Distant_points_will_return_alone()
		{
			MapPoint.Size = 10;
			var points = new List<MapPoint>()
				{
					new MapPoint(0, 0, null),
					new MapPoint(30, 30, null),
				};

			var clusterer = new MapItemClusterer();

			// act

			var result = clusterer.CollectClusteredItems(points, 1);

			// assert
			Assert.That(result.Count, Is.EqualTo(0));
			Assert.That(points.Count(p => p.State == PointState.Handled), Is.EqualTo(2));
			Assert.That(points.Count(p => p.State == PointState.Clustered), Is.EqualTo(0));
		}

		[Test]
		public void Near_points_will_be_clustered()
		{
			var points = new List<MapPoint>()
				{
					new MapPoint(0, 0, null),
					new MapPoint(5, 5, null),
				};

			var clusterer = new MapItemClusterer();

			// act

			var result = clusterer.CollectClusteredItems(points, 1);

			// assert
			Assert.That(result.Count, Is.EqualTo(1));
			Assert.That(result[0].Count, Is.EqualTo(2));
			Assert.That(points.Count(p => p.State == PointState.Clustered), Is.EqualTo(2));
		}

		[Test]
		public void Detect_multiple_clusters()
		{
			var points = new List<MapPoint>()
				{
					new MapPoint(0, 0, null),
					new MapPoint(5, 5, null),

					new MapPoint(50, 50, null),
					new MapPoint(55, 55, null),
					new MapPoint(53, 53, null),
				};

			var clusterer = new MapItemClusterer();

			// act

			var result = clusterer.CollectClusteredItems(points, 1);

			// assert
			Assert.That(result.Count, Is.EqualTo(2));
			Assert.That(result[0].Count, Is.EqualTo(2));
			Assert.That(result[1].Count, Is.EqualTo(3));
			Assert.That(points.Count(p => p.State == PointState.Clustered), Is.EqualTo(5));
		}

		[Test]
		public void Multiple_clusters_merged()
		{
			var points = new List<MapPoint>()
				{
					new MapPoint(0, 0, null),
					new MapPoint(5, 5, null),

					new MapPoint(30, 32, null),
					new MapPoint(35, 35, null),
					new MapPoint(39, 39, null),
				};

			var clusterer = new MapItemClusterer();

			// act

			var result = clusterer.CollectClusteredItems(points, 1);

			// assert
			Assert.That(result.Count, Is.EqualTo(1));
			Assert.That(result[0].Count, Is.EqualTo(5));

			Assert.IsTrue(points.All(p => p.State == PointState.Clustered));

		}
	}
}
