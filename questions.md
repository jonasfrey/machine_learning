i need help with technical terms. lets say i want to use kmeans algo for a 5 dimensional point. then would i measure the 'distance' like  pythagroas for 3d points but foreach component?

so for example(p = point, c = component), a point would have (c0, c1, c2, c3, c4)


dist = sqrt(

 (p0c0-p1c0)^2+
 (p0c1-p1c1)^2+
 (p0c2-p1c2)^2+
 (p0c3-p1c3)^2+
 (p0c4-p1c4)^2
)

-- 
answer yes. be careful to normalize the data first!