import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import assets = require('@aws-cdk/aws-s3-assets');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import elbv2       = require('@aws-cdk/aws-elasticloadbalancingv2');
import { Role, ServicePrincipal, ManagedPolicy } from '@aws-cdk/aws-iam'
import { UserData } from '@aws-cdk/aws-ec2';

export class WebsiteStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Parameter setup - create a key for login to ec2 instance
    const KeyPair = new cdk.CfnParameter(this, "KeyPair", {
      type: "AWS::EC2::KeyPair::KeyName",
      default: "keypair",
      description:
        "Event Engine Name of the EC2 KeyPair generated for the Team",
    });

    // Get latest AMI build from EC2 instance
    const latestAMI = new cdk.CfnParameter(this, "LatestAMI", {
      type: "AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>",
      default:
        "/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-ebs",
      description: "Latest AMI from linux",
    });

    // create the VPC setup, 2 AZ in a new VPC
    const vpc = new ec2.Vpc(this, "WebsiteVPC", {
      cidr: '10.40.0.0/16',
      maxAzs: 2,
      natGatewayProvider: ec2.NatProvider.gateway(),
      subnetConfiguration: [{
              subnetType: ec2.SubnetType.PUBLIC,
              name: 'public',
              cidrMask: 24
          }],
    });
  // const securityGroup = new ec2.SecurityGroup(scope, "DevAxNetworkSG", {
  //     allowAllOutbound: true,
  //     vpc,
  //     securityGroupName: "DBSecurityGroup"
  // });
  const role = new Role(this, 'NewsBlogRole', {
    assumedBy: new ServicePrincipal('ec2.amazonaws.com')
  });
  // allow system manager agent to make api calls to systems manager 
  role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

  // create the auto scaling groups with 2 instances each.
  const autoScalingGroups : autoscaling.AutoScalingGroup[] = [];
  // define a user data script to install & launch our web server
  const pageResponse = "\"Hello World from $(hostname -f) on port 80\"";
  const userData = UserData.forLinux();
  userData.addCommands('yum install -y nginx', 'chkconfig nginx on', 'service nginx start');
  userData.addCommands(`/bin/mv /usr/share/nginx/html/index.html /usr/share/nginx/html/index.html.orig`,
                       `/bin/echo ${pageResponse} >  /usr/share/nginx/html/index.html`);

  // create an auto scaling group for each environment
  const asg = new autoscaling.AutoScalingGroup(this, `NewsBlogAutoScalingGroup`, {
    vpc,
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
    machineImage: new ec2.AmazonLinuxImage(),
    desiredCapacity: 2,
    role: role,
    userData: userData
  });

  autoScalingGroups.push(asg);

  // create a load balancer
  const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
    vpc,
    internetFacing: true
  });

  const listener = lb.addListener('Listener', {
    port: 80,
  });

  listener.connections.allowDefaultPortFromAnyIpv4('Open to the world');

  listener.addTargets(`Targets`, {
    port: 80,
    targets: autoScalingGroups
  });    

  // add a scaling rule
  autoScalingGroups.forEach(asg => {
    asg.scaleOnRequestCount(`AModestLoad-${asg}`, {
      targetRequestsPerSecond: 1
    });
  });


  }
}
