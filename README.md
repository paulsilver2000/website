# Website project to create a base nginx in a ASG on latest linux2 AMI

- looks at the latest linux2 ami
- creates an ASG
- creates SG
- creates a LB
- creates port 80 only
- can optionally use default login, but would need to open up port 22, just used to confirm if it worked
- iam least priviledge
- vpc with public AZ x 2

to run, remove package-lock.json
```bash 
npm install
```
![Sample architecture](/images/SampleSolution.jpg)
