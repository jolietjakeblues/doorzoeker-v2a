using System;
using Trezorix.RnaRemote.Core.Predicates;

namespace RceDoorzoeker.Services
{
	public class Facet : IEquatable<Facet>
	{
		public string FieldName { get; set; }
		public Predicate Predicate { get; set; }
		
		public FacetType Type { get; set; }
		public bool Enabled { get; set; }

		public bool Equals(Facet other)
		{
			if (ReferenceEquals(null, other))
			{
				return false;
			}
			if (ReferenceEquals(this, other))
			{
				return true;
			}
			return string.Equals(FieldName, other.FieldName);
		}

		public override bool Equals(object obj)
		{
			if (ReferenceEquals(null, obj))
			{
				return false;
			}
			if (ReferenceEquals(this, obj))
			{
				return true;
			}
			if (obj.GetType() != this.GetType())
			{
				return false;
			}
			return Equals((Facet) obj);
		}

		public override int GetHashCode()
		{
			return (FieldName != null ? FieldName.GetHashCode() : 0);
		}

		public static bool operator ==(Facet left, Facet right)
		{
			return Equals(left, right);
		}

		public static bool operator !=(Facet left, Facet right)
		{
			return !Equals(left, right);
		}
	}
}