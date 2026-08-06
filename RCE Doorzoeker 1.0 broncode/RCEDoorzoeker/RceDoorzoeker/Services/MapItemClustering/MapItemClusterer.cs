using System;
using System.Collections.Generic;
using System.Linq;
using RceDoorzoeker.Services.Querying;

namespace RceDoorzoeker.Services.MapItemClustering
{
	public class MapItemClusterer
	{
		private double MapPointSizeSquared(double latLongPerPixel)
		{
			return Math.Pow(MapPoint.Size * latLongPerPixel, 2.0);
		}

		public ClusteredItems CreateClustering(IEnumerable<SearchResultItem> points, double latLongPerPixel)
		{
			var mapPoints = points.Select(p => new MapPoint(p.Coordinate, p)).ToList();

			var clusteredItems = CollectClusteredItems(mapPoints, latLongPerPixel);
			
			return new ClusteredItems()
				{
					Clusters = clusteredItems,
					Points = mapPoints
								.Where(p => p.State == PointState.Handled)
								.Select(p => p.MapObject)
								.Cast<SearchResultItem>()
								.ToList(),
					TotalCount = mapPoints.Count()
				};
		}

		internal List<Cluster> CollectClusteredItems(IList<MapPoint> points, double latLongPerPixel)
		{
			var pointSizeSquared = Math.Pow(MapPoint.Size * latLongPerPixel, 2.0);

			var clusters = new List<Cluster>(points.Count / 8);

			var point = points.FirstOrDefault();

			while (point != null)
			{
				point.State = PointState.Handled;

				var clusterPoints = points
					.Where(p => 
						p.State == PointState.Unhandled
						&& DistanceSquared(point.LatLong, p.LatLong) < pointSizeSquared)
					.ToList();

				if (clusterPoints.Any())
				{
					var cluster = new Cluster(latLongPerPixel)
						{
							Count = clusterPoints.Count + 1,
							Center = point.LatLong
						};

					point.State = PointState.Clustered;
					foreach (var regionPoint in clusterPoints)
					{
						regionPoint.State = PointState.Clustered;
					}

					bool haveMerged;
					do
					{
						haveMerged = MergeClusters(clusters, cluster);

						if (haveMerged)
						{
							haveMerged = MergePoints(points, cluster, latLongPerPixel);
						}
					} while (haveMerged);

					clusters.Add(cluster);
				}
				point = points.FirstOrDefault(p => p.State == PointState.Unhandled);
			}
			
			return clusters;
		}

		private bool MergePoints(IEnumerable<MapPoint> points, Cluster cluster, double latLongPerPixel)
		{
			var intersectingPoints = points
				.Where(p => p.State != PointState.Clustered && DistanceSquared(p.LatLong, cluster.Center) < cluster.PointSizeLatLongSquared() + MapPointSizeSquared(latLongPerPixel))
				.ToList();

			if (!intersectingPoints.Any()) return false;

			cluster.Count += intersectingPoints.Count;

			intersectingPoints.ForEach(p =>
			{
				p.State = PointState.Clustered;
			});

			return true;
		}

		private bool MergeClusters(List<Cluster> clusters, Cluster cluster)
		{
			var intersectingClusters = clusters
				.Where(r => DistanceSquared(r.Center, cluster.Center) < r.PointSizeLatLongSquared() + cluster.PointSizeLatLongSquared())
				.ToList();

			if (!intersectingClusters.Any()) return false;

			// merge the intersecting regions
			foreach (var ir in intersectingClusters)
			{
				if (cluster.Count > ir.Count)
				{
					cluster.Center = ir.Center;
				}
				cluster.Count += ir.Count;
				clusters.Remove(ir);
			}

			// recurse
			MergeClusters(clusters, cluster);

			return true;
		}

		private static double DistanceSquared(LatLong p1, LatLong p2)
		{
			double diffLong =  p2.Longitude - p1.Longitude;
			double diffLat = p2.Latitude - p1.Latitude;
			return Math.Abs(diffLong * diffLong + diffLat * diffLat);
		}
	}
}