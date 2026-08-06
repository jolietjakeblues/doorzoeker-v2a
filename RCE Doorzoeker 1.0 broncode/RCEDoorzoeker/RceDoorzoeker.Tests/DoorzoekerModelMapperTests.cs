using AutoMapper;
using NUnit.Framework;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Services;
using RceDoorzoeker.Services.Mappers;

namespace RceDoorzoeker.Tests
{
	[TestFixture]
	public class DoorzoekerModelMapperTests
	{
		[Test]
		public void CreateMapping_should_pass()
		{
			// arrange
			
			// act
			DoorzoekerModelMapper.ConfigureMapper();

			// assert
			Mapper.AssertConfigurationIsValid();
		}
	}
}